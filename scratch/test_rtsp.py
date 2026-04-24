import cv2
import sys

url = "rtsp://192.168.137.245:1945/"
print(f"Testing connection to: {url}")

cap = cv2.VideoCapture(url)
if not cap.isOpened():
    print("FAILED: Could not open video source.")
    sys.exit(1)

print("SUCCESS: Connection established. Press 'q' to quit.")
while True:
    ret, frame = cap.read()
    if not ret:
        print("ERROR: Failed to read frame.")
        break
    
    cv2.imshow("RTSP Test", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
