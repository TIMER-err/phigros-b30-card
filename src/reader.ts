/** Little-endian reader for Phigros' save binary format. */
export class ByteReader {
  position = 0
  private readonly view: DataView

  constructor(private readonly buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  }

  get remaining() {
    return this.buf.length - this.position
  }

  byte() {
    return this.buf[this.position++]
  }

  int32() {
    const v = this.view.getInt32(this.position, true)
    this.position += 4
    return v
  }

  float32() {
    const v = this.view.getFloat32(this.position, true)
    this.position += 4
    return v
  }

  /** LEB128 unsigned varint. */
  varInt() {
    let result = 0
    let shift = 0
    for (;;) {
      const b = this.byte()
      result |= (b & 0x7f) << shift
      if ((b & 0x80) === 0) return result
      shift += 7
    }
  }

  string() {
    const len = this.varInt()
    const s = new TextDecoder().decode(
      this.buf.subarray(this.position, this.position + len)
    )
    this.position += len
    return s
  }
}
