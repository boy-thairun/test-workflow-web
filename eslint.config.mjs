import tseslint from 'typescript-eslint';

export default [
  { ignores: ['.agents/**', '.github/**'] },
  ...tseslint.configs.recommended,
];
