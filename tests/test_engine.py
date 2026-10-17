import json

import polars as pl
import pytest

from datasetmedic.engine import audit, execute_recipe, load_frame, render_report, transform


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
