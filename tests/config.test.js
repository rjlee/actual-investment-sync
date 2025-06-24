const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../src/config');

describe('config.loadConfig', () => {
  const cwd = process.cwd();
  const yamlFile = path.join(cwd, 'config.yaml');
  const ymlFile = path.join(cwd, 'config.yml');
  const jsonFile = path.join(cwd, 'config.json');

  afterEach(() => {
    [yamlFile, ymlFile, jsonFile].forEach((f) => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
  });

  it('returns empty object if no config files exist', () => {
    const cfg = loadConfig();
    expect(cfg).toEqual({});
  });

  it('loads JSON config correctly', () => {
    fs.writeFileSync(jsonFile, JSON.stringify({ foo: 'bar' }));
    const cfg = loadConfig();
    expect(cfg).toEqual({ foo: 'bar' });
  });

  it('loads YAML config correctly', () => {
    fs.writeFileSync(yamlFile, 'foo: baz\nnum: 42');
    const cfg = loadConfig();
    expect(cfg).toEqual({ foo: 'baz', num: 42 });
  });

  it('errors on invalid JSON', () => {
    fs.writeFileSync(jsonFile, '{not: valid}');
    expect(() => loadConfig()).toThrow(/Failed to parse configuration file config.json/);
  });

  it('errors on invalid YAML', () => {
    fs.writeFileSync(yamlFile, 'foo: [unclosed');
    expect(() => loadConfig()).toThrow(/Failed to parse configuration file config.yaml/);
  });
});