declare module "shpjs" {
  const shp: (input: ArrayBuffer | ArrayBufferView) => Promise<unknown>;
  export default shp;
}
