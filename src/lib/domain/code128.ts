// Código de barras Code 128 (conjunto B), sem biblioteca externa.
// Lido por qualquer leitor USB/Bluetooth comum: o leitor "digita" o número da OS e dá Enter.

const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232",
];
const START_B = 104;
const STOP = "2331112";

/** Só caracteres imprimíveis ASCII (espaço até ~) entram no conjunto B. */
export function code128Encodable(value: string) {
  return value.length > 0 && value.length <= 40 && /^[\x20-\x7E]+$/.test(value);
}

/** Larguras alternadas barra/espaço (começa com barra), incluindo início, verificador e fim. */
export function code128Widths(value: string): number[] {
  if (!code128Encodable(value)) throw new Error("Código inválido para Code 128.");
  const codes = [START_B, ...[...value].map((char) => char.charCodeAt(0) - 32)];
  const check = codes.reduce((sum, code, index) => sum + code * (index === 0 ? 1 : index), 0) % 103;
  const pattern = [...codes, check].map((code) => PATTERNS[code]).join("") + STOP;
  return [...pattern].map(Number);
}
