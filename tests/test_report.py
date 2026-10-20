from html.parser import HTMLParser

import polars as pl

from datasetmedic.engine import audit, render_report


class Document(HTMLParser):
    def __init__(self, markup):
        super().__init__()
        self.elements = []
        self.text = []
        self.feed(markup)

    def handle_starttag(self, tag, attributes):
        self.elements.append((tag, dict(attributes)))

    def handle_data(self, data):
        self.text.append(data)


def test_report_escapes_evidence_and_connects_semantic_tables_and_navigation():
    frame = pl.DataFrame({'value': ['<script>alert("x")</script>'] * 2, 'flag': [False, False],
                          'empty': [None, None]})
    report = render_report(audit({'source': frame}, {}), {'source': '<img src=x onerror=alert(1)>'}, cleaned=True)
    doc = Document(report)
    assert '<script>' not in report
    assert '&lt;script&gt;' in report
    assert '&lt;img' in report
    assert 'Cleaned export' in ''.join(doc.text)
    assert '>false</td>' in report
    assert '>Missing</td>' in report
    assert not any(tag in ('script', 'img', 'iframe', 'link') for tag, _ in doc.elements)
    assert not any(key.startswith('on') for _, attributes in doc.elements for key in attributes)
    ids = [attributes['id'] for _, attributes in doc.elements if 'id' in attributes]
    assert len(ids) == len(set(ids))
    for _, attributes in doc.elements:
        if 'aria-labelledby' in attributes:
            assert attributes['aria-labelledby'] in ids
        if 'href' in attributes:
            assert attributes['href'].startswith('#')
            assert attributes['href'][1:] in ids
    assert any(tag == 'th' and attributes.get('scope') == 'row' for tag, attributes in doc.elements)
    assert any(tag == 'meta' and attributes.get('name') == 'viewport' for tag, attributes in doc.elements)


def test_report_small_missing_rate_and_empty_report():
    frame = pl.DataFrame({'x': [None] + [1] * 2000})
    report = render_report(audit({'source': frame}, {}), {})
    assert '&lt;0.1%' in report
    assert '1 / 2,001' in report
    empty = render_report({'profiles': {}, 'findings': [], 'notice': 'No leakage guarantee.'}, {})
    assert 'No findings from the selected checks.' in empty
    assert 'No datasets in this report.' in empty
    assert 'Audit snapshot' in empty


def test_wide_report_examples_keep_all_fields_without_a_wide_table():
    frame = pl.DataFrame({f'field_{index}': ['東京', '東京'] for index in range(9)})
    report = render_report(audit({'source': frame}, {}), {})
    assert 'Wide examples are listed field-by-field.' in report
    assert '<th scope=\'col\'>Field</th><th scope=\'col\'>Value</th>' in report
    for index in range(9):
        assert f'<th scope=\'row\'>field_{index}</th><td>&quot;東京&quot;</td>' in report
