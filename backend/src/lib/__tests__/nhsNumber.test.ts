import { extractNhsNumber } from '../nhsNumber';

describe('extractNhsNumber', () => {
  it('extracts a spaced NHS number', () => {
    expect(extractNhsNumber('NHS Number: 705 249 3519')).toBe('7052493519');
  });

  it('extracts an unformatted NHS number', () => {
    expect(extractNhsNumber('Patient: 7052493519')).toBe('7052493519');
  });

  it('extracts a hyphenated NHS number', () => {
    expect(extractNhsNumber('Ref: 705-249-3519')).toBe('7052493519');
  });

  it('extracts NHS number from surrounding text', () => {
    const letter = `
      Dear Dr Smith,
      Patient NHS No: 705 249 3519
      Please find enclosed the results.
    `;
    expect(extractNhsNumber(letter)).toBe('7052493519');
  });

  it('returns undefined when no NHS number is present', () => {
    expect(extractNhsNumber('No number in this text')).toBeUndefined();
  });

  it('returns undefined for a number that is too short', () => {
    expect(extractNhsNumber('Ref: 12345')).toBeUndefined();
  });
});
