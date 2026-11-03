import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { columnIndex, detectDelimiter, parseCsv, parseXlsx, ParseError, toFraction, toIsoDate, toNumber } from './parsers';

describe('CSV parser', () => {
  it('handles quotes, escaped quotes, CRLF and BOM', () => {
    const rows = parseCsv('﻿Name,Fee\r\n"Clinic, Phase ""A""","$1,200"\r\nTower,500\r\n');
    expect(rows).toEqual([
      ['Name', 'Fee'],
      ['Clinic, Phase "A"', '$1,200'],
      ['Tower', '500'],
    ]);
  });
  it('detects semicolon and tab delimiters', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('keeps newlines inside quoted fields and skips blank lines', () => {
    expect(parseCsv('a,b\n"line1\nline2",x\n\n')).toEqual([['a', 'b'], ['line1\nline2', 'x']]);
  });
  it('rejects an unterminated quote', () => {
    expect(() => parseCsv('a,"b\n1,2')).toThrow(ParseError);
  });
});

describe('value coercion', () => {
  it('parses currency without altering magnitude', () => {
    expect(toNumber('$5,110,000')).toBe(5110000);
    expect(toNumber('(1,000)')).toBe(-1000);
    expect(toNumber('')).toBeNull();
    expect(toNumber('-')).toBeNull();
    expect(toNumber('abc')).toBeUndefined();
  });
  it('reads fractions and flags percentage interpretation', () => {
    expect(toFraction('50%')).toEqual({ value: 0.5, interpreted: false });
    expect(toFraction(0.93)).toEqual({ value: 0.93, interpreted: false });
    expect(toFraction(50)).toEqual({ value: 0.5, interpreted: true });
    expect(toFraction(null)).toEqual({ value: null, interpreted: false });
  });
  it('converts dates and Excel serials', () => {
    expect(toIsoDate('2027-03-01')).toBe('2027-03-01');
    expect(toIsoDate('3/1/2027')).toBe('2027-03-01');
    expect(toIsoDate(46447)).toBe('2027-03-01');
    expect(toIsoDate(12)).toBeUndefined();
  });
  it('maps column letters', () => {
    expect(columnIndex('A1')).toBe(0);
    expect(columnIndex('Z9')).toBe(25);
    expect(columnIndex('AA10')).toBe(26);
  });
});

function makeXlsx(): ArrayBuffer {
  const files = {
    '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    'xl/workbook.xml': strToU8('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Pipeline" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
    'xl/sharedStrings.xml': strToU8('<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Project Name</t></si><si><t>Fee</t></si><si><r><t>Fictional </t></r><r><t>Clinic</t></r></si></sst>'),
    'xl/worksheets/sheet1.xml': strToU8(
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
        '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>547149</v></c></row>' +
        '<row r="4"><c r="A4" t="inlineStr"><is><t>Inline Name</t></is></c><c r="C4"><v>0.5</v></c></row>' +
        '</sheetData></worksheet>',
    ),
  };
  const z = zipSync(files);
  return z.buffer.slice(z.byteOffset, z.byteOffset + z.byteLength) as ArrayBuffer;
}

describe('XLSX parser', () => {
  it('reads shared strings, rich text, inline strings, numbers and sparse cells', () => {
    const [sheet] = parseXlsx(makeXlsx());
    expect(sheet.name).toBe('Pipeline');
    expect(sheet.rows[0]).toEqual(['Project Name', 'Fee']);
    expect(sheet.rows[1]).toEqual(['Fictional Clinic', 547149]);
    expect(sheet.rows[2]).toEqual([]);
    expect(sheet.rows[3]).toEqual(['Inline Name', null, 0.5]);
  });
  it('rejects non-zip input', () => {
    expect(() => parseXlsx(new TextEncoder().encode('not a zip').buffer as ArrayBuffer)).toThrow(ParseError);
  });
});
