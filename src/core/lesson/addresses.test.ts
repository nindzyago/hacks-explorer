// L4.2: every IP address and domain in a lesson is from a documentation range
// (RFC 5737, RFC 3849, RFC 2606 and RFC 6761 names).
import { describe, expect, it } from 'vitest';
import { findForeignAddresses } from './addresses';

const values = (text: string) => findForeignAddresses(text).map((a) => a.value);

describe('findForeignAddresses', () => {
  it.each([
    '192.0.2.1',
    '198.51.100.255',
    '203.0.113.0/24',
    '2001:db8::1',
    '2001:DB8:0:0:0:0:0:1',
    '2001:0db8::',
    'example.com',
    'www.example.org',
    'api.example.net',
    'shop.example',
    'bank-login.example',
    'mail.test',
    'anna@bank.example',
    'http://shop.example/login',
    'x.invalid',
    'localhost',
  ])('accepts %s', (text) => {
    expect(values(text)).toEqual([]);
  });

  it.each([
    ['8.8.8.8', '8.8.8.8'],
    ['10.0.0.1', '10.0.0.1'],
    ['127.0.0.1', '127.0.0.1'],
    ['192.0.3.1', '192.0.3.1'],
    ['адрес 203.0.114.5.', '203.0.114.5'],
    ['2001:db9::1', '2001:db9::1'],
    ['::1', '::1'],
    ['fe80::1', 'fe80::1'],
    ['google.com', 'google.com'],
    ['www.example.com.evil.org', 'www.example.com.evil.org'],
    ['example.co', 'example.co'],
    ['notexample.com', 'notexample.com'],
    ['shop.ru', 'shop.ru'],
    ['bank.РФ', 'bank.РФ'],
    ['anna@gmail.com', 'gmail.com'],
    ['https://evil.io/x', 'evil.io'],
    ['ПРИМЕР.COM', 'ПРИМЕР.COM'],
  ])('rejects %s', (text, value) => {
    expect(values(text)).toEqual([value]);
  });

  it('reports where each address is', () => {
    expect(findForeignAddresses('a\nb 8.8.8.8 c\n  google.com')).toEqual([
      { value: '8.8.8.8', kind: 'ip', index: 4 },
      { value: 'google.com', kind: 'domain', index: 16 },
    ]);
  });

  it.each([
    'A03:2021',
    'CVSS:3.1/AV:N/AC:L',
    'версия 1.2.3',
    '12:30:45',
    'std::string',
    'CWE-89 и T1566.002',
    'файл index.html и запрос users',
    'Node.js',
    'т.е. и т.д.',
    '999.1.1.1',
    'SELECT * FROM users WHERE login = ?',
  ])('does not take %s for an address', (text) => {
    expect(values(text)).toEqual([]);
  });
});
