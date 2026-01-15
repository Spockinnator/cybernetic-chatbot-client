import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const production = !process.env.ROLLUP_WATCH;

// Common plugins for both builds
const commonPlugins = [
  resolve({
    browser: true
  }),
  commonjs()
];

// Main entry point (core + tree-shakeable agentic)
const mainConfig = {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/cybernetic-chatbot-client.esm.js',
      format: 'esm',
      sourcemap: true
    },
    {
      file: 'dist/cybernetic-chatbot-client.umd.js',
      format: 'umd',
      name: 'AsterMindCybernetic',
      sourcemap: true
    },
    {
      file: 'dist/cybernetic-chatbot-client.min.js',
      format: 'umd',
      name: 'AsterMindCybernetic',
      plugins: [terser()],
      sourcemap: true
    }
  ],
  plugins: [
    ...commonPlugins,
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: 'dist'
    })
  ]
};

// Full entry point (core + explicit agentic inclusion)
// Note: Shares types with main build, no need for separate declarations
const fullConfig = {
  input: 'src/full.ts',
  output: [
    {
      file: 'dist/cybernetic-chatbot-client-full.esm.js',
      format: 'esm',
      sourcemap: true
    },
    {
      file: 'dist/cybernetic-chatbot-client-full.umd.js',
      format: 'umd',
      name: 'AsterMindCyberneticFull',
      sourcemap: true
    },
    {
      file: 'dist/cybernetic-chatbot-client-full.min.js',
      format: 'umd',
      name: 'AsterMindCyberneticFull',
      plugins: [terser()],
      sourcemap: true
    }
  ],
  plugins: [
    ...commonPlugins,
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false  // Main build handles declarations
    })
  ]
};

export default [mainConfig, fullConfig];
