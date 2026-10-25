"""Pure dataset operations shared by the app and exported reproduction scripts."""
from __future__ import annotations

import hashlib
import math
from itertools import combinations
from pathlib import Path
from typing import Any

import polars as pl

from datasetmedic.report import render_report as render_report  # noqa: PLC0414 -- public compatibility export

MAX_ROWS = 2_000_000
MAX_COLUMNS = 500
DTYPES = {"text": pl.String, "integer": pl.Int64, "decimal": pl.Float64, "boolean": pl.Boolean, "date": pl.Date}


class RecipeError(ValueError):
    """An invalid recipe step, with a one-based position shared by every runner."""

    def __init__(self, step: int, operation: str, detail: str):
        self.step = step
        self.operation = operation
        super().__init__(f"Step {step} ({operation}): {detail}")


def safe(value: Any) -> Any:
    """Convert Polars/date/nonfinite values into strict, portable JSON."""
    if isinstance(value, dict):
        return {str(k): safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [safe(v) for v in value]
    if isinstance(value, float) and not math.isfinite(value):
        return None
    # JSON numbers are parsed as IEEE-754 doubles in browsers; preserve identifier evidence exactly.
    if isinstance(value, int) and abs(value) > 2**53 - 1:
        return str(value)
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def load_frame(path: str | Path, options: dict | None = None) -> pl.DataFrame:
    path = Path(path)
    options = options or {}
    if path.suffix.lower() == ".parquet":
        scan = pl.scan_parquet(path)
    elif path.suffix.lower() == ".csv":
        # Preserve mixed values as text rather than silently dropping invalid rows.
        sep = options.get("separator", ",")
        if sep not in [",", ";", "\t", "|"]:
            raise ValueError("Choose a comma, semicolon, tab, or pipe separator.")
        scan = pl.scan_csv(path, separator=sep, infer_schema_length=10000, try_parse_dates=False,
                           encoding="utf8", null_values=[""], raise_if_empty=True)
        try:
            scan.head(MAX_ROWS + 1).collect(engine="streaming")
        except pl.exceptions.ComputeError:
            scan = pl.scan_csv(path, separator=sep, infer_schema=False, encoding="utf8", null_values=[""])
    else:
        raise ValueError("Only CSV and Parquet files are supported.")
    schema = scan.collect_schema()
    if any(dtype.is_nested() for dtype in schema.values()):
        raise ValueError("Nested Parquet columns are not supported in this release. Flatten them first.")
    if len(schema) > MAX_COLUMNS:
        raise ValueError(f"This release supports up to {MAX_COLUMNS} columns per file.")
    frame = scan.head(MAX_ROWS + 1).collect(engine="streaming")
    if frame.height > MAX_ROWS:
        raise ValueError(f"This release supports up to {MAX_ROWS:,} rows per file. Split the file first.")
    if not frame.height or not frame.width:
        raise ValueError("The dataset needs a header and at least one data row.")
    return frame


def is_numeric(dtype: pl.DataType) -> bool:
    return dtype.is_numeric()


def missing_expr(name: str, dtype: pl.DataType) -> pl.Expr:
    expr = pl.col(name).is_null()
    if dtype.is_float():
        expr = expr | pl.col(name).is_nan()
    return expr


def observed_values(series: pl.Series) -> pl.Series:
    """Exclude the same null/NaN values classified as missing by the audit."""
    values = series.drop_nulls()
    return values.drop_nans() if series.dtype.is_float() else values


def evidence(df: pl.DataFrame, mask: pl.Expr) -> list[dict]:
    label = "source_row"
    while label in df.columns:
        label += "_"
    # Filter row positions first, so matching rows beyond the sample never copy wide column buffers.
    indices = df.select(pl.int_range(pl.len(), dtype=pl.UInt32).filter(mask).head(12)).to_series()
    sample = df[indices]
    sample.insert_column(0, pl.Series(label, indices + 1))
    return safe(sample.to_dicts())


def profile(df: pl.DataFrame) -> dict:
    columns = []
    for name, dtype in df.schema.items():
        s = df[name]
        item = {"name": name, "dtype": str(dtype), "missing": df.select(missing_expr(name, dtype).sum()).item(),
                "unique": s.n_unique(), "examples": safe(s.drop_nulls().head(4).to_list())}
        if is_numeric(dtype):
            clean = s.filter(s.is_finite()) if dtype.is_float() else s
            item["stats"] = safe({"mean": clean.mean(), "median": clean.median(), "std": clean.std(),
                                   "min": clean.min(), "max": clean.max()})
        else:
            counts = s.value_counts(sort=True).head(5)
            item["top"] = safe([{"value": r[0], "count": r[1]} for r in counts.iter_rows()])
        columns.append(item)
    return {"rows": df.height, "columns": columns, "sample": safe(df.head(12).to_dicts())}


def audit(frames: dict[str, pl.DataFrame], config: dict) -> dict:
    roles = config.get("roles", {})
    target = config.get("target") or None
    groups = config.get("groups", [])
    selected = config.get("features", [])
    findings = []
    profiles = {}

    def add(kind, title, detail, dataset, count, examples=None, severity="warning", columns=None):
        findings.append({"id": f"finding-{len(findings)+1}", "kind": kind, "title": title,
                         "detail": detail, "datasets": dataset, "count": count,
                         "examples": examples or [], "severity": severity, "columns": columns or []})

    for key, df in frames.items():
        profiles[key] = profile(df)
        for col in profiles[key]["columns"]:
            name = col["name"]
            if col["missing"]:
                add("missing", f"Missing values in {name}", "Null and NaN values may need an explicit handling strategy.",
                    [key], col["missing"], evidence(df, missing_expr(name, df.schema[name])), columns=[name])
            if df[name].drop_nulls().n_unique() <= 1:
                add("constant", f"Constant or empty column: {name}", "This column has at most one non-null value.",
                    [key], df.height, columns=[name], severity="info")
            if df.schema[name] == pl.String:
                values = pl.col(name).str.strip_chars()
                numeric = values.cast(pl.Float64, strict=False).is_not_null()
                n_valid = df.select(numeric.sum()).item()
                n_present = df[name].len() - df[name].null_count()
                if 0 < n_valid < n_present:
                    add("mixed_type", f"Mixed numeric and text values: {name}",
                        "Some text values parse as numbers and others do not. Review before converting.",
                        [key], n_present - n_valid,
                        evidence(df, pl.col(name).is_not_null() & ~numeric), columns=[name])
        duplicates = df.is_duplicated()
        extra = df.height - df.unique().height
        if extra:
            add("duplicate", "Repeated records", "Count is extra copies beyond the first occurrence of each row.",
                [key], extra, safe(df.filter(duplicates).head(12).to_dicts()))
        if target and target in df.columns:
            values = observed_values(df[target])
            if 1 < values.n_unique() <= 100:
                counts = values.value_counts(sort=True)
                frequencies = [r[1] for r in counts.iter_rows()]
                ratio = max(frequencies) / min(frequencies)
                add("class_balance", f"Class balance: {target}",
                    f"Largest/smallest observed class ratio is {ratio:.2f}. Suitability depends on the task.",
                    [key], len(values), safe([{"label": r[0], "count": r[1]} for r in counts.iter_rows()]),
                    "warning" if ratio >= 4 else "info", [target])

    split_keys = [k for k in frames if roles.get(k) in ("train", "validation", "test")]
    for left, right in combinations(split_keys, 2):
        if roles[left] == roles[right]:
            continue
        a, b = frames[left], frames[right]
        common = [c for c in a.columns if c in b.columns]
        mismatches = [{"column": c, "left": str(a.schema[c]) if c in a.columns else "absent",
                       "right": str(b.schema[c]) if c in b.columns else "absent"}
                      for c in dict.fromkeys(a.columns + b.columns)
                      if c not in common or a.schema[c] != b.schema[c]]
        if mismatches:
            add("schema", "Split schemas differ", "Columns must have compatible types for exact overlap checks.",
                [left, right], len(mismatches), mismatches)
        features = selected or [c for c in common if c != target and c not in groups]
        if not features:
            add("overlap_skipped", "No feature columns to compare", "Choose at least one common feature column.",
                [left, right], 0, severity="info")
        elif any(c not in common or a.schema[c] != b.schema[c] for c in features):
            add("overlap_skipped", "Record comparison needs matching schemas",
                "Align the selected feature columns and types, then run the audit again.", [left, right], 0)
        else:
            # Hash narrows candidates; the actual join includes every feature, so collisions cannot create findings.
            hashcol = "__medic_hash__"
            while hashcol in features:
                hashcol += "_"
            x = a.select(features).unique().with_columns(pl.struct(features).hash(seed=42).alias(hashcol))
            y = b.select(features).unique().with_columns(pl.struct(features).hash(seed=42).alias(hashcol))
            match = x.join(y, on=[hashcol, *features], how="semi", nulls_equal=True).drop(hashcol)
            if match.height:
                affected_a = a.join(match, on=features, how="semi", nulls_equal=True).height
                affected_b = b.join(match, on=features, how="semi", nulls_equal=True).height
                add("split_overlap", "Identical features across splits",
                    f"{affected_a} rows on the left and {affected_b} on the right share {match.height} distinct feature records. "
                    "Exact comparison includes null equality; matching records are evidence to review.",
                    [left, right], match.height, safe(match.head(12).to_dicts()), "danger", features)
        for group in groups:
            if group not in common or a.schema[group] != b.schema[group]:
                add("group_skipped", f"Cannot compare group: {group}", "Group column is absent or has differing types.",
                    [left, right], 0, columns=[group])
                continue
            shared = a.select(group).drop_nulls().unique().join(b.select(group).drop_nulls().unique(), on=group, how="semi")
            if shared.height:
                add("group_overlap", f"Shared subjects: {group}",
                    "These non-null group identifiers occur in both splits. Assess whether your evaluation requires independent subjects.",
                    [left, right], shared.height, safe(shared.head(12).to_dicts()), "danger", [group])
    comparisons = []
    for left, right in combinations(split_keys, 2):
        if roles[left] != roles[right]:
            right_cols = {c["name"]: c for c in profiles[right]["columns"]}
            comparisons.append({"datasets": [left, right], "columns": [
                {"name": c["name"], "left": c, "right": right_cols[c["name"]]}
                for c in profiles[left]["columns"] if c["name"] in right_cols]})
    return safe({"profiles": profiles, "findings": findings, "comparisons": comparisons,
                 "notice": "These checks find specific risks. No findings does not prove that a dataset is free of leakage."})


def transform(frames: dict[str, pl.DataFrame], recipe: dict, roles: dict) -> tuple[dict, dict]:
    """Apply an ordered recipe without mutating inputs; return outputs and actual learned values."""
    out = {k: v.clone() for k, v in frames.items()}
    changes = []
    fitted = {}
    for index, step in enumerate(recipe.get("steps", [])):
        op = step["op"]
        try:
            cols = step.get("columns", [])
            if op != "deduplicate" and not cols:
                raise ValueError(f"Choose columns for {op}.")
            for key, df in out.items():
                absent = [c for c in cols if c not in df.columns]
                if absent:
                    raise ValueError(f"Dataset {key} is missing columns: {', '.join(absent)}")
            learned = {}
            if op == "fill":
                method = step.get("method", "median")
                if method not in ("median", "mode", "constant"):
                    raise ValueError("Unknown fill strategy.")
                trains = [k for k in out if roles.get(k) == "train"]
                if method != "constant" and len(trains) != 1 and len(out) > 1:
                    raise ValueError("Learned filling across multiple datasets requires exactly one training dataset.")
                fit = out[trains[0] if trains else next(iter(out))]
                for col in cols:
                    series = fit[col]
                    if series.dtype.is_float():
                        series = series.fill_nan(None)
                    if method == "median":
                        if not is_numeric(series.dtype):
                            raise ValueError(f"Median requires numeric values: {col}")
                        value = series.median()
                    elif method == "mode":
                        modes = series.drop_nulls().mode().sort()
                        value = modes[0] if len(modes) else None
                    else:
                        value = step.get("value")
                    if value is None:
                        raise ValueError(f"Cannot fill {col}: the fitting data has no usable value.")
                    learned[col] = value
                fitted[str(index)] = safe(learned)
            for key, original in list(out.items()):
                df = original
                failures = {}
                if op == "drop":
                    if len(cols) == df.width:
                        raise ValueError("Keep at least one column.")
                    df = df.drop(cols)
                    affected = original.height
                elif op == "deduplicate":
                    df = df.unique(maintain_order=True)
                    affected = original.height - df.height
                else:
                    expressions = []
                    affected_mask = pl.lit(False)
                    for col in cols:
                        before = pl.col(col)
                        if op == "trim":
                            if df.schema[col] != pl.String:
                                raise ValueError(f"Trimming requires text: {col}")
                            after = before.str.strip_chars()
                        elif op == "cast":
                            dtype = DTYPES.get(step.get("dtype"))
                            if dtype is None:
                                raise ValueError("Choose a supported conversion type.")
                            if dtype == pl.Date and df.schema[col] == pl.String:
                                after = before.str.to_date(format="%Y-%m-%d", strict=False)
                            elif dtype == pl.Boolean and df.schema[col] == pl.String:
                                lower = before.str.to_lowercase().str.strip_chars()
                                after = pl.when(lower.is_in(["true", "1"])).then(True).when(lower.is_in(["false", "0"])).then(False).otherwise(None)
                            else:
                                after = before.cast(dtype, strict=False)
                            failures[col] = df.select((before.is_not_null() & after.is_null()).sum()).item()
                        elif op == "fill":
                            value = learned[col]
                            if df.schema[col] == pl.Boolean:
                                if isinstance(value, str):
                                    choices = {"true": True, "false": False, "1": True, "0": False}
                                    token = value.strip().lower()
                                    if token not in choices:
                                        raise ValueError(f"Boolean fill for {col} must be true, false, 1, or 0.")
                                    value = choices[token]
                                elif value not in (0, 1):
                                    raise ValueError(f"Boolean fill for {col} must be true, false, 1, or 0.")
                            if df.schema[col].is_float():
                                before = before.fill_nan(None)
                            # Integer median may be fractional; widen rather than truncate.
                            if isinstance(value, float) and df.schema[col].is_integer():
                                before = before.cast(pl.Float64)
                            try:
                                typed = pl.Series([value]).cast(df.select(before).schema[col], strict=True)[0]
                            except (pl.exceptions.PolarsError, TypeError) as exc:
                                raise ValueError(f"Fill value is incompatible with {col}. Convert the type first.") from exc
                            after = before.fill_null(typed)
                        else:
                            raise ValueError(f"Unknown cleaning operation: {op}")
                        old = pl.col(col)
                        if op == "fill":
                            changed = missing_expr(col, original.schema[col])
                        elif op == "cast":
                            changed = old.is_not_null() if str(original.schema[col]) != str(DTYPES[step["dtype"]]) else old.ne_missing(after)
                        else:
                            changed = old.ne_missing(after)
                        affected_mask = affected_mask | changed
                        expressions.append(after.alias(col))
                    affected = df.select(affected_mask.sum()).item()
                    df = df.with_columns(expressions)
                out[key] = df
                changes.append({"step": index + 1, "dataset": key, "op": op, "affected_rows": affected,
                                "conversion_failures": failures, "before_rows": original.height, "after_rows": df.height})
        except (ValueError, pl.exceptions.PolarsError) as exc:
            raise RecipeError(index + 1, op, str(exc)) from exc
    return out, {"changes": changes, "fitted_values": fitted,
                 "profiles": {k: profile(v) for k, v in out.items()}}


def execute_recipe(inputs: dict[str, str], recipe: dict, roles: dict, output: str | Path,
                   options: dict | None = None, output_format: str = "parquet") -> dict:
    """Stable public reproduction interface; used unchanged by downloaded scripts."""
    frames = {k: load_frame(p, (options or {}).get(k)) for k, p in inputs.items()}
    cleaned, summary = transform(frames, recipe, roles)
    destination = Path(output)
    destination.mkdir(parents=True, exist_ok=True)
    if output_format not in ("csv", "parquet"):
        raise ValueError("Output format must be csv or parquet.")
    for index, (key, frame) in enumerate(cleaned.items(), 1):
        # Never use untrusted dataset names as file paths.
        path = destination / f"dataset-{index}.{output_format}"
        if any(path.resolve() == Path(p).resolve() for p in inputs.values()):
            raise ValueError("Choose an output directory separate from source files.")
        if output_format == "csv":
            frame.write_csv(path)
        else:
            frame.write_parquet(path)
    return summary


def fingerprint(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()
