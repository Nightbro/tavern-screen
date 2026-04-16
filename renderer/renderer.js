const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Placeholder — map image and grid overlay will be drawn here
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff33';
  ctx.font = '24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Tavern Screen — Map View', canvas.width / 2, canvas.height / 2);
}

window.addEventListener('resize', resize);
resize();
