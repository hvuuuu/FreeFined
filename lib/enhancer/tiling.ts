export interface TileRegion {
  x: number
  y: number
  width: number
  height: number
}

export function buildTileGrid(
  imageWidth: number,
  imageHeight: number,
  tileSize: number,
): TileRegion[] {
  const tiles: TileRegion[] = []

  for (let y = 0; y < imageHeight; y += tileSize) {
    for (let x = 0; x < imageWidth; x += tileSize) {
      tiles.push({
        x,
        y,
        width: Math.min(tileSize, imageWidth - x),
        height: Math.min(tileSize, imageHeight - y),
      })
    }
  }

  return tiles
}
