// Include headroom for a tap jump combined with a stretch, and sideways sway.
// Shared by every character and risk level so switching artwork never changes scale.
export const mascotViewport = { x: -48, y: -104, width: 416, height: 416 } as const;
export const mascotViewBox = `${mascotViewport.x} ${mascotViewport.y} ${mascotViewport.width} ${mascotViewport.height}`;
