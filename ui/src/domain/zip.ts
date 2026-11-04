export interface ZipEntry {
  readonly name: string
  readonly bytes: Uint8Array
}

const CRC_TABLE: readonly number[] = Array.from({ length: 256 }, (_, n) =>
  Array.from({ length: 8 }, () => 0).reduce((crc: number) => (crc & 1) === 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1, n),
)

const crc32 = (bytes: Uint8Array): number =>
  (bytes.reduce((crc: number, b) => (CRC_TABLE[(crc ^ b) & 0xff] ?? 0) ^ (crc >>> 8), 0xffffffff) ^ 0xffffffff) >>> 0

const u16 = (v: number): readonly number[] => [v & 0xff, (v >>> 8) & 0xff]
const u32 = (v: number): readonly number[] => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]

const dosTime = (d: Date): readonly number[] => u16((d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2))
const dosDate = (d: Date): readonly number[] => u16(((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate())

const encoder = new TextEncoder()

const localHeader = (entry: ZipEntry, when: Date, crc: number): Uint8Array =>
  Uint8Array.from([
    ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...dosTime(when), ...dosDate(when),
    ...u32(crc), ...u32(entry.bytes.length), ...u32(entry.bytes.length),
    ...u16(encoder.encode(entry.name).length), ...u16(0), ...Array.from(encoder.encode(entry.name)),
  ])

const centralEntry = (entry: ZipEntry, when: Date, crc: number, offset: number): Uint8Array =>
  Uint8Array.from([
    ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...dosTime(when), ...dosDate(when),
    ...u32(crc), ...u32(entry.bytes.length), ...u32(entry.bytes.length),
    ...u16(encoder.encode(entry.name).length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
    ...Array.from(encoder.encode(entry.name)),
  ])

const eocd = (count: number, cdSize: number, cdOffset: number): Uint8Array =>
  Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(count), ...u16(count), ...u32(cdSize), ...u32(cdOffset), ...u16(0)])

export const createZip = async (entries: readonly ZipEntry[], when: Date = new Date()): Promise<Uint8Array> => {
  const withCrc = entries.map(entry => ({ entry, crc: crc32(entry.bytes) }))
  const offsets = withCrc.reduce<number[]>((acc, { entry }) => [...acc, (acc.at(-1) ?? 0) + 30 + encoder.encode(entry.name).length + entry.bytes.length], [0])
  const locals = withCrc.map(({ entry, crc }, i) => ({ local: localHeader(entry, when, crc), bytes: entry.bytes, offset: offsets[i] ?? 0 }))
  const cdOffset = offsets.at(-1) ?? 0
  const central = withCrc.map(({ entry, crc }, i) => centralEntry(entry, when, crc, locals[i]?.offset ?? 0))
  const end = eocd(entries.length, central.reduce((n, c) => n + c.length, 0), cdOffset)
  const parts = [...locals.flatMap(l => [l.local, l.bytes]), ...central, end] as BlobPart[]
  const blob = new Blob(parts, { type: 'application/zip' })
  return new Uint8Array(await blob.arrayBuffer())
}
