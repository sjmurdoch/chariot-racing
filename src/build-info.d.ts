declare module 'virtual:build-info' {
  import type { BuildInfo } from '../build/build-info';
  const info: BuildInfo;
  export default info;
}
