class UIRenderer {
  static clear(ctx, width, height, color = '#f5f7fb') {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
  }

  static drawTitle(ctx, text, x, y) {
    ctx.save();
    ctx.fillStyle = '#1f2d3d';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  static drawText(ctx, text, x, y, options = {}) {
    ctx.save();
    ctx.fillStyle = options.color || '#333';
    ctx.font = options.font || '16px sans-serif';
    ctx.textAlign = options.align || 'center';
    ctx.textBaseline = options.baseline || 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  static drawButton(ctx, btn) {
    ctx.save();
    ctx.fillStyle = btn.bg || '#3d7eff';
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);

    ctx.fillStyle = btn.color || '#fff';
    ctx.font = btn.font || '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.text, btn.x + btn.w / 2, btn.y + btn.h / 2);
    ctx.restore();
  }

  static hitButton(x, y, btn) {
    return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
  }

  static drawCard(ctx, rect, fill = '#fff') {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }
}

module.exports = UIRenderer;