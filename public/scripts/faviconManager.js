class FaviconManager {
    constructor() {
      this.link = this.createFaviconLink();
      this.canvas = this.createCanvas();
      this.ctx = this.canvas.getContext("2d");
      this.frame = 0;
      this.ballX = 4;
      this.ballY = 4;
      this.ballDX = 1;
      this.ballDY = 1;
      this.paddle1Y = 2;
      this.paddle2Y = 2;

      this.animate();
    }

    createFaviconLink() {
      let link = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      return link;
    }

    createCanvas() {
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      return canvas;
    }

    drawGame() {
      // Clear with dark background
      this.ctx.fillStyle = "#0F111A";
      this.ctx.fillRect(0, 0, 16, 16);

      // Draw paddles
      this.ctx.fillStyle = "#FF0090";
      this.ctx.fillRect(1, this.paddle1Y, 1, 4);
      this.ctx.fillRect(14, this.paddle2Y, 1, 4);

      // Draw ball
      this.ctx.fillStyle = "#00E0FF";
      this.ctx.fillRect(this.ballX, this.ballY, 2, 2);

      // Update ball position
      this.ballX += this.ballDX;
      this.ballY += this.ballDY;

      // Ball collision with top/bottom
      if (this.ballY <= 0 || this.ballY >= 14) {
        this.ballDY *= -1;
      }

      // Ball collision with paddles
      if (
        (this.ballX <= 2 &&
          this.ballY >= this.paddle1Y &&
          this.ballY <= this.paddle1Y + 4) ||
        (this.ballX >= 13 &&
          this.ballY >= this.paddle2Y &&
          this.ballY <= this.paddle2Y + 4)
      ) {
        this.ballDX *= -1;
      }

      // Reset ball if it goes past paddles
      if (this.ballX < 0 || this.ballX > 15) {
        this.ballX = 8;
        this.ballY = 8;
      }

      // Move paddles
      this.paddle1Y = Math.max(0, Math.min(12, this.ballY - 2));
      this.paddle2Y = Math.max(0, Math.min(12, this.ballY - 2));
    }

    animate() {
      this.drawGame();
      this.link.href = this.canvas.toDataURL();

      // Run at 15 FPS why ? cuz why not lol
      setTimeout(() => this.animate(), 1000 / 15);
    }
  }

  new FaviconManager();