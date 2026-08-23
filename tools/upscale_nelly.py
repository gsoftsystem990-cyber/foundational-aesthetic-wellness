import cv2
from cv2 import dnn_superres
from pathlib import Path

src = Path(
    r"C:\Users\Raja Faizan\.cursor\projects\c-Users-Raja-Faizan-Desktop-New-Website-Project\assets\c__Users_Raja_Faizan_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_nelly-silva-0b878365-826b-44b1-bc74-d932e7996bb7.png"
)
out = Path(r"C:\Users\Raja Faizan\Desktop\New Website Project\nelly-silva-ultra-hd.png")
out_4k = Path(r"C:\Users\Raja Faizan\Desktop\New Website Project\nelly-silva-ultra-hd-4k.png")
model = Path(r"C:\Users\Raja Faizan\Desktop\New Website Project\tools\opencv-models\EDSR_x4.pb")

img = cv2.imread(str(src), cv2.IMREAD_COLOR)
if img is None:
    raise SystemExit(f"Failed to read image: {src}")
print("input", img.shape)

sr = dnn_superres.DnnSuperResImpl_create()
sr.readModel(str(model))
sr.setModel("edsr", 4)
result = sr.upsample(img)
print("edsr_x4", result.shape)

# Gentle detail-preserving sharpen (unsharp mask)
blur = cv2.GaussianBlur(result, (0, 0), 0.8)
sharp = cv2.addWeighted(result, 1.2, blur, -0.2, 0)

cv2.imwrite(str(out), sharp, [cv2.IMWRITE_PNG_COMPRESSION, 1])
print("saved", out, out.stat().st_size)

# Second pass: high-quality Lanczos to ~4K height for true ultra-HD delivery
h, w = sharp.shape[:2]
target_h = 4096
scale = target_h / h
target_w = int(round(w * scale))
up_4k = cv2.resize(sharp, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)
blur4 = cv2.GaussianBlur(up_4k, (0, 0), 0.6)
sharp4 = cv2.addWeighted(up_4k, 1.15, blur4, -0.15, 0)
cv2.imwrite(str(out_4k), sharp4, [cv2.IMWRITE_PNG_COMPRESSION, 1])
print("saved", out_4k, out_4k.stat().st_size, sharp4.shape)
