const video = document.getElementById("camera");
const hud = document.getElementById("hud");
const qrFrame = document.getElementById("qr-frame");

let scanCanvas, ctx, stream;
let scanning = false;
let animationId;
let resultBanner;

// ---------- Public API ----------
window.scanQRCode = async function () {
  if (scanning) return; // already running
  scanning = true;

  // Show HUD
  hud.style.display = "flex";

  // Create hidden canvas
  scanCanvas = document.createElement("canvas");
  ctx = scanCanvas.getContext("2d");

  // Create result banner if missing
  if (!resultBanner) {
    resultBanner = document.createElement("div");
    resultBanner.className = "banner";
    hud.appendChild(resultBanner);
  }

  // Add exit button if missing
  if (!document.getElementById("qr-exit")) {
    const exitBtn = document.createElement("button");
    exitBtn.id = "qr-exit";
    exitBtn.textContent = "✕";
    exitBtn.onclick = stopScanning;
    hud.appendChild(exitBtn);
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    video.srcObject = stream;
    animationId = requestAnimationFrame(scanFrame);
  } catch (err) {
    showBanner("Camera error: " + err.message, "error");
    console.error(err);
    scanning = false;
  }
};

// ---------- Stop Camera ----------
function stopScanning() {
  scanning = false;
  cancelAnimationFrame(animationId);
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
  }
  video.srcObject = null;
  hud.style.display = "none";
}

// ---------- Scan Loop ----------
function scanFrame() {
  if (!scanning) return;

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    const width = video.videoWidth / 2;
    const height = video.videoHeight / 2;
    scanCanvas.width = width;
    scanCanvas.height = height;

    ctx.drawImage(video, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const code = jsQR(imageData.data, width, height);

    if (code) {
      // Stop scanning temporarily
      cancelAnimationFrame(animationId);

      // Call verifier
      Promise.resolve(window.verifyQRCode(code.data))
        .then((ok) => {
          if (ok) {
            showBanner("✅ Valid code!", "success");
            setTimeout(stopScanning, 3000); // auto-close
          } else {
            showBanner("❌ Invalid code", "error");

            // hide banner after 3s and resume scanning
            setTimeout(() => {
              if (scanning) {
                resultBanner.textContent = "";
                resultBanner.className = "banner"; // reset style
                animationId = requestAnimationFrame(scanFrame);
              }
            }, 3000);
          }
        })
        .catch((err) => {
          console.error("verifyQRCode error:", err);
          showBanner("❌ Verification failed", "error");

          setTimeout(() => {
            if (scanning) {
              resultBanner.textContent = "";
              resultBanner.className = "banner";
              animationId = requestAnimationFrame(scanFrame);
            }
          }, 3000);
        });

      return;
    }
  }
  animationId = requestAnimationFrame(scanFrame);
}

// ---------- Helper: Banner ----------
function showBanner(msg, type) {
  if (!resultBanner) return;
  resultBanner.textContent = msg;
  resultBanner.className = "banner " + type;
}
