"""Standalone, script-free HTML reports with escaped tabular evidence."""
import html
import json


def _esc(value):
    return html.escape(str(value))


def _value(value):
    if value is None:
        return "Missing"
    return json.dumps(value, ensure_ascii=False, default=str)


def _table(headers, rows, caption, identifier, *, row_headers=False):
    head = "".join(f"<th scope='col'>{_esc(column)}</th>" for column in headers)
    body = ""
    for row in rows:
        cells = [f"<th scope='row'>{_esc(value)}</th>" if row_headers and index == 0 else f"<td>{_esc(value)}</td>"
                 for index, value in enumerate(row)]
        body += "<tr>" + "".join(cells) + "</tr>"
    return (f"<div class='table-wrap' role='region' tabindex='0' aria-labelledby='{identifier}'>"
            f"<table><caption id='{identifier}'>{_esc(caption)}</caption><thead><tr>{head}</tr></thead>"
            f"<tbody>{body}</tbody></table></div>")


def render_report(result: dict, names: dict, *, cleaned: bool = False) -> str:
    """Render only the supplied audit snapshot; no network assets or executable code."""
    profiles = []
    for index, (key, profile) in enumerate(result["profiles"].items()):
        name = names.get(key, key)
        rows = profile["rows"]
        columns = profile["columns"]
        records = []
        for column in columns:
            missing = column["missing"]
            rate = "Not available" if not rows else "<0.1%" if 0 < missing / rows < .001 else f"{missing / rows:.1%}"
            records.append([column["name"], column["dtype"], f"{missing:,} / {rows:,}", rate, f"{column['unique']:,}"])
        profiles.append(f"<article aria-labelledby='dataset-{index}'><h3 id='dataset-{index}'>{_esc(name)}</h3>"
                        f"<p>{rows:,} rows · {len(columns):,} columns</p>"
                        + _table(["Column", "Type", "Missing / rows", "Missing rate", "Distinct values"], records,
                                 f"Column profile for {name}", f"profile-{index}", row_headers=True) + "</article>")
    findings = []
    for index, finding in enumerate(result["findings"]):
        examples = finding.get("examples", [])
        headers = list(dict.fromkeys(key for example in examples for key in example))
        if len(headers) > 8:
            evidence = "<p>Wide examples are listed field-by-field.</p>" + "".join(
                _table(["Field", "Value"], [[key, _value(value)] for key, value in example.items()],
                       f"Example {sample + 1} for {finding['title']}", f"evidence-{index}-{sample}", row_headers=True)
                for sample, example in enumerate(examples))
        elif headers:
            evidence = _table(headers, [[_value(example[key]) if key in example else "Not recorded" for key in headers]
                                        for example in examples], f"Examples for {finding['title']}", f"evidence-{index}")
        else:
            evidence = "<p>No examples recorded.</p>"
        datasets = ", ".join(names.get(key, key) for key in finding["datasets"])
        findings.append(f"<article aria-labelledby='finding-{index}'>"
                        f"<p class='meta'>{_esc(finding['severity'])} · {_esc(datasets)}</p>"
                        f"<h3 id='finding-{index}'>{_esc(finding['title'])} ({_esc(finding['count'])})</h3>"
                        f"<p>{_esc(finding['detail'])}</p>{evidence}</article>")
    stage = "Cleaned export" if cleaned else "Audit snapshot"
    return """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>DatasetMedic report</title><style>
*{box-sizing:border-box}body{font:16px/1.7 system-ui,sans-serif;margin:0;color:#183e36;background:#f6f7f2}
header,main,footer,nav{max-width:1060px;margin:auto;padding:24px}header{padding-top:48px}h1{font:42px/1.2 Georgia,serif}
h2{font:30px/1.3 Georgia,serif}h3{font-size:19px}h1,h2,h3,p{overflow-wrap:anywhere}article{background:#fff;padding:24px;margin:18px 0;border:1px solid #d6dfd5;border-radius:14px}
.meta,footer{color:#536647;font-size:14px}nav{display:flex;gap:24px;flex-wrap:wrap;padding-top:0;padding-bottom:0}a{color:#244f36;text-underline-offset:4px}
.skip{position:absolute;top:8px;left:8px;transform:translateY(-180%);background:#fff;padding:10px;z-index:2}.skip:focus{transform:none}
a:focus-visible,.table-wrap:focus-visible,main:focus-visible{outline:3px solid #597e3e;outline-offset:4px}
.table-wrap{overflow:auto;max-width:100%;border:1px solid #dce3d8;border-radius:8px;margin-top:18px;overscroll-behavior:contain}
table{border-collapse:collapse;min-width:100%;font-size:14px}caption{text-align:left;font-weight:600;padding:12px;background:#eef3e7}
th,td{text-align:left;vertical-align:top;padding:10px 14px;border-bottom:1px solid #e1e7dc;min-width:110px;max-width:360px;overflow-wrap:anywhere;white-space:pre-wrap}th{background:#f7f9f2}
.notice{padding:16px;border-left:4px solid #6b864f;background:#edf3e4}section{scroll-margin-top:20px}footer{border-top:1px solid #d6dfd5;margin-top:24px}
@media(max-width:600px){header,main,footer,nav{padding:18px}h1{font-size:32px}h2{font-size:26px}article{padding:16px}.table-wrap{font-size:13px}}
@media print{body{background:#fff}header,main,footer,nav{max-width:none;padding:8px}nav,.skip{display:none}article{border:1px solid #aaa;border-radius:0}.table-wrap{overflow:visible}table{width:100%;table-layout:fixed}th,td{min-width:0;font-size:10px;padding:5px}h2,h3{break-after:avoid}}
</style></head><body><a class="skip" href="#report-main">Skip to report</a>
<header><p class="meta">DATASETMEDIC · """ + stage + "</p><h1>Dataset health report</h1>" \
        f"<p class='notice'>{_esc(result['notice'])}</p></header>" \
        "<nav aria-label='Report sections'><a href='#datasets'>Datasets</a><a href='#findings'>Findings</a></nav>" \
        "<main id='report-main' tabindex='-1'><section id='datasets' aria-labelledby='datasets-title'>" \
        "<h2 id='datasets-title'>Datasets</h2>" + ("".join(profiles) or "<p>No datasets in this report.</p>") \
        + "</section><section id='findings' aria-labelledby='findings-title'>" \
        f"<h2 id='findings-title'>Findings ({len(findings):,})</h2>" \
        + ("".join(findings) or "<p>No findings from the selected checks.</p>") \
        + "</section><p>Missing rates use each dataset’s own row count and are rounded for display. " \
        "Distinct counts include missing values. Example tables show up to 12 records; source row numbers, " \
        "when present, are 1-based data rows after the header.</p></main>" \
        "<footer>Generated locally by DatasetMedic. This report may contain source values; handle it like your dataset.</footer></body></html>"
