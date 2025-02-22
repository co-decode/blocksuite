/// <reference types="@blocksuite/global" />
export * from './space.js';
export * from './store.js';
export * from './base.js';
export * from './awareness.js';
export * from './persistence/blob/index.js';
export * from './text-adapter.js';
export * from '@blocksuite/global/utils';
export * from './persistence/doc/index.js';
export * from './workspace/index.js';
export * as Utils from './utils/utils.js';
export {
  createAutoIncrementIdGenerator,
  createAutoIncrementIdGeneratorByClientId,
  uuidv4,
  nanoid,
} from './utils/id-generator.js';
export type { IdGenerator } from './utils/id-generator.js';

const env =
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
    ? window
    : // @ts-ignore
    typeof global !== 'undefined'
    ? // @ts-ignore
      global
    : {};
const importIdentifier = '__ $BLOCKSUITE_STORE$ __';

// @ts-ignore
if (env[importIdentifier] === true) {
  // https://github.com/yjs/yjs/issues/438
  console.error(
    '@blocksuite/store was already imported. This breaks constructor checks and will lead to issues!'
  );
}
// @ts-ignore
env[importIdentifier] = true;
