import json

import polars as pl
import pytest

from datasetmedic.engine import (
    RecipeError,
    audit,
    evidence,
    execute_recipe,
    load_frame,
    render_report,
    safe,
    transform,
)


@pytest.mark.parametrize("mode", ["some", "all", "none", "nullable"])
@pytest.mark.parametrize("rows", [0, 7, 40])
def test_evidence_index_sampling_preserves_exact_records_order_and_originals(mode, rows):
    frame = pl.DataFrame({"value": list(range(rows)), "source_row": ["original"] * rows,
                          "source_row_": list(range(rows)), "__datasetmedic_row__": [False] * rows,
                          "text": ["東京" if index % 2 else None for index in range(rows)],
                          "identifier": [2**53 + index for index in range(rows)]})
    before = frame.clone()
    masks = {"some": pl.col("value") % 2 == 0, "all": pl.lit(True), "none": pl.lit(False),
             "nullable": pl.when(pl.col("value") % 3 == 0).then(None).otherwise(pl.col("value") > 4)}
    mask = masks[mode]
    expected = safe(frame.with_row_index("__datasetmedic_row___", offset=1).filter(mask).head(12)
                    .rename({"__datasetmedic_row___": "source_row__"}).to_dicts())
    assert evidence(frame, mask) == expected
    assert frame.equals(before)


@pytest.mark.parametrize("step", [
    {"op": "fill", "columns": ["noise"], "method": "constant", "value": "x"},
    {"op": "trim", "columns": ["x"]},
    {"op": "fill", "columns": ["text"], "method": "median"},
    {"op": "fill", "columns": ["empty"], "method": "median"},
])
def test_recipe_errors_identify_step_and_preserve_originals(step):
    frame = pl.DataFrame({"x": [1, 2], "text": ["A", "B"], "noise": ["a", "b"],
                          "empty": pl.Series([None, None], dtype=pl.Float64)})
    before = frame.clone()
    with pytest.raises(RecipeError) as caught:
        transform({"train": frame}, {"steps": [{"op": "drop", "columns": ["noise"]}, step]}, {})
    assert caught.value.step == 2
    assert caught.value.operation == step["op"]
    assert str(caught.value).startswith(f"Step 2 ({step['op']}): ")
    assert isinstance(caught.value, ValueError)
    assert frame.equals(before)


def test_recipe_execution_uses_same_error_context_without_writing_outputs(tmp_path):
    source = tmp_path / "original.csv"
    content = b"x,noise\n1,a\n2,b\n"
    source.write_bytes(content)
    output = tmp_path / "cleaned"
    recipe = {"steps": [{"op": "drop", "columns": ["noise"]},
                        {"op": "fill", "columns": ["noise"], "method": "constant", "value": "x"}]}
    with pytest.raises(RecipeError, match=r"Step 2 \(fill\): Dataset source is missing columns: noise"):
        execute_recipe({"source": str(source)}, recipe, {}, output)
    assert source.read_bytes() == content
    assert not output.exists()


def test_unsupported_polars_conversion_keeps_recipe_context():
    frame = pl.DataFrame({"x": [b"A", b"B"]})
    recipe = {"steps": [{"op": "deduplicate"}, {"op": "cast", "columns": ["x"], "dtype": "date"}]}
    with pytest.raises(RecipeError, match=r"Step 2 \(cast\):") as caught:
        transform({"source": frame}, recipe, {})
    assert caught.value.operation == "cast"
    assert isinstance(caught.value.__cause__, pl.exceptions.PolarsError)
    assert frame["x"].to_list() == [b"A", b"B"]


def test_audit_exact_evidence():
    a = pl.DataFrame({"subject": ["a", "b", "b", "c"], "x": [1, 2, 2, None], "label": [0, 0, 0, 1]})
    b = pl.DataFrame({"subject": ["a", "z"], "x": [1, 4], "label": [1, 0]})
    result = audit({"train": a, "test": b}, {"roles": {"train": "train", "test": "test"},
                   "groups": ["subject"], "target": "label"})
    f = result["findings"]
    assert next(x for x in f if x["kind"] == "duplicate")["count"] == 1
    assert next(x for x in f if x["kind"] == "missing")["examples"][0]["source_row"] == 4
    assert next(x for x in f if x["kind"] == "split_overlap")["count"] == 1
    assert next(x for x in f if x["kind"] == "group_overlap")["examples"] == [{"subject": "a"}]
    assert len(result["comparisons"]) == 1


def test_schema_mismatch_and_null_group():
    a = pl.DataFrame({"subject": [None, "a"], "x": [1, 2]})
    b = pl.DataFrame({"subject": [None, "b"], "x": ["1", "3"], "extra": [1, 2]})
    f = audit({"a": a, "b": b}, {"roles": {"a": "train", "b": "test"}, "groups": ["subject"]})["findings"]
    assert any(x["kind"] == "schema" for x in f)
    assert any(x["kind"] == "overlap_skipped" for x in f)
    assert not any(x["kind"] == "group_overlap" for x in f)


def test_fill_fits_train_and_fractional_median():
    train = pl.DataFrame({"x": [1, 4, None]})
    test = pl.DataFrame({"x": [1000, None]})
    cleaned, summary = transform({"a": train, "b": test}, {"steps": [{"op": "fill", "columns": ["x"], "method": "median"}]}, {"a": "train", "b": "test"})
    assert cleaned["a"]["x"].to_list() == [1.0, 4.0, 2.5]
    assert cleaned["b"]["x"].to_list() == [1000.0, 2.5]
    assert train["x"].null_count() == 1
    assert summary["fitted_values"]["0"]["x"] == 2.5


def test_cleaning_order_and_conversion_failures():
    df = pl.DataFrame({"text": [" 1 ", "bad", " 1 "], "extra": [1, 2, 1]})
    recipe = {"steps": [{"op": "trim", "columns": ["text"]},
                         {"op": "cast", "columns": ["text"], "dtype": "integer"},
                         {"op": "deduplicate"}, {"op": "drop", "columns": ["extra"]}]}
    out, summary = transform({"a": df}, recipe, {})
    assert out["a"].to_dicts() == [{"text": 1}, {"text": None}]
    assert summary["changes"][1]["conversion_failures"] == {"text": 1}
    assert df["text"][0] == " 1 "


def test_fill_errors_and_all_null():
    with pytest.raises(ValueError, match="exactly one training"):
        transform({"a": pl.DataFrame({"x": [1]}), "b": pl.DataFrame({"x": [2]})},
                  {"steps": [{"op": "fill", "columns": ["x"]}]}, {})
    with pytest.raises(ValueError, match="no usable value"):
        transform({"a": pl.DataFrame({"x": [None]}, schema={"x": pl.Float64})},
                  {"steps": [{"op": "fill", "columns": ["x"], "method": "median"}]}, {})


def test_unicode_mixed_csv_and_parquet(tmp_path):
    csv = tmp_path / "input.csv"
    csv.write_text("city,value\n東京,1\nPune,bad\nDelhi,\n", encoding="utf-8")
    df = load_frame(csv)
    assert df["city"][0] == "東京"
    assert df["value"].null_count() == 1
    result = audit({"a": df}, {})
    assert any(x["kind"] == "mixed_type" for x in result["findings"])
    path = tmp_path / "input.parquet"
    df.write_parquet(path)
    assert load_frame(path).equals(df)


@pytest.mark.parametrize("content", ["", "x,y\n", 'x,y\n1,"unclosed'])
def test_empty_malformed(tmp_path, content):
    p = tmp_path / "bad.csv"
    p.write_text(content)
    with pytest.raises((ValueError, pl.exceptions.PolarsError)):
        load_frame(p)


def test_mode_is_deterministic_and_nan_is_missing():
    a = pl.DataFrame({"x": [float("nan"), 1.0, 3.0], "word": ["b", "a", None]})
    out, summary = transform({"a": a}, {"steps": [{"op": "fill", "columns": ["x"], "method": "median"},
                                                {"op": "fill", "columns": ["word"], "method": "mode"}]}, {})
    assert out["a"]["x"][0] == 2.0
    assert out["a"]["word"][2] == "a"
    json.dumps(summary, allow_nan=False)


def test_report_escapes_untrusted_content():
    df = pl.DataFrame({"<script>alert(1)</script>": [1, 1]})
    report = render_report(audit({"a": df}, {}), {"a": "<script>evil()</script>"})
    assert "<script>" not in report
    assert "&lt;script&gt;" in report


def test_reproduction_interface(tmp_path):
    source = tmp_path / "original.csv"
    source.write_text("x\n1\n1\n2\n")
    recipe = {"steps": [{"op": "deduplicate"}]}
    execute_recipe({"source": str(source)}, recipe, {}, tmp_path / "out")
    assert pl.read_parquet(tmp_path / "out/dataset-1.parquet")["x"].to_list() == [1, 2]
    assert source.read_text() == "x\n1\n1\n2\n"


def test_constant_string_and_date_conversion():
    frame = pl.DataFrame({"x": [None, "a"], "date": ["2026-01-01", "bad"]})
    out, summary = transform({"a": frame}, {"steps": [
        {"op": "fill", "columns": ["x"], "method": "constant", "value": "Unknown"},
        {"op": "cast", "columns": ["date"], "dtype": "date"}]}, {})
    assert out["a"]["x"][0] == "Unknown"
    assert summary["changes"][1]["conversion_failures"]["date"] == 1


def test_source_row_name_and_nested_parquet(tmp_path):
    frame = pl.DataFrame({"source_row": [1, 2], "x": [None, 1]})
    findings = audit({"a": frame}, {})["findings"]
    assert findings[0]["examples"][0]["source_row_"] == 1
    path = tmp_path / "nested.parquet"
    pl.DataFrame({"nested": [[1, 2]]}).write_parquet(path)
    with pytest.raises(ValueError, match="Nested Parquet"):
        load_frame(path)


@pytest.mark.parametrize(("value", "expected"), [("true", True), (" FALSE ", False), ("1", True), ("0", False)])
def test_boolean_constant_fills_from_form_text(value, expected):
    original = pl.DataFrame({"flag": [True, None, False]})
    result, summary = transform({"a": original}, {"steps": [
        {"op": "fill", "columns": ["flag"], "method": "constant", "value": value}]}, {})
    assert result["a"]["flag"].to_list() == [True, expected, False]
    assert result["a"].schema["flag"] == pl.Boolean
    assert summary["changes"][0]["affected_rows"] == 1
    assert original["flag"].null_count() == 1


def test_large_integer_evidence_is_json_safe():
    values = [2**53 - 1, 2**53, 2**53 + 1, -(2**53 + 1)]
    result = audit({"a": pl.DataFrame({"subject": values})}, {})
    sample = result["profiles"]["a"]["sample"]
    assert [r["subject"] for r in sample] == [2**53 - 1, str(2**53), str(2**53 + 1), str(-(2**53 + 1))]
    assert safe({"flag": True, "count": 42}) == {"flag": True, "count": 42}


@pytest.mark.parametrize("value", ["yes", "2", 2])
def test_ambiguous_boolean_constant_is_rejected(value):
    with pytest.raises(ValueError, match="must be true, false, 1, or 0"):
        transform({"a": pl.DataFrame({"flag": [True, None]})}, {"steps": [
            {"op": "fill", "columns": ["flag"], "method": "constant", "value": value}]}, {})


def test_hash_collisions_do_not_create_overlap(monkeypatch):
    monkeypatch.setattr(pl.Expr, "hash", lambda self, *args, **kwargs: pl.lit(42, dtype=pl.UInt64))
    frames = {"a": pl.DataFrame({"x": [1, 2]}), "b": pl.DataFrame({"x": [2, 3]})}
    findings = audit(frames, {"roles": {"a": "train", "b": "test"}, "features": ["x"]})["findings"]
    overlaps = [f for f in findings if f["kind"] == "split_overlap"]
    assert len(overlaps) == 1
    assert overlaps[0]["count"] == 1
    assert overlaps[0]["examples"] == [{"x": 2}]


def test_row_and_column_limits_reject_instead_of_truncating(tmp_path, monkeypatch):
    from datasetmedic import engine

    path = tmp_path / "data.csv"
    path.write_text("x\n1\n2\n3\n")
    monkeypatch.setattr(engine, "MAX_ROWS", 2)
    with pytest.raises(ValueError, match="up to 2 rows"):
        load_frame(path)
    path.write_text("x,y\n1,2\n")
    monkeypatch.setattr(engine, "MAX_COLUMNS", 1)
    with pytest.raises(ValueError, match="up to 1 columns"):
        load_frame(path)
