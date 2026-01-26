import cv2
import numpy as np
import json
import sys

def order_points(pts):
    # initialzie a list of coordinates that will be ordered
    # such that the first entry in the list is the top-left,
    # the second entry is the top-right, the third is the
    # bottom-right, and the fourth is the bottom-left
    rect = np.zeros((4, 2), dtype = "float32")
    # the top-left point will have the smallest sum, whereas
    # the bottom-right point will have the largest sum
    s = pts.sum(axis = 1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    # now, compute the difference between the points, the
    # top-right point will have the smallest difference,
    # whereas the bottom-left will have the largest difference
    diff = np.diff(pts, axis = 1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    # return the ordered coordinates
    return rect

def four_point_transform(image, pts):
    # obtain a consistent order of the points and unpack them
    rect = order_points(pts)
    (tl, tr, br, bl) = rect
    # compute the width of the new image, which will be the
    # maximum distance between bottom-right and bottom-left
    # x-coordiates or the top-right and top-left x-coordinates
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))
    # compute the height of the new image, which will be the
    # maximum distance between the top-right and bottom-right
    # y-coordinates or the top-left and bottom-left y-coordinates
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))
    # now that we have the dimensions of the new image, construct
    # the set of destination points to obtain a "birds eye view",
    # (i.e. top-down view) of the image, again specifying points
    # in the top-left, top-right, bottom-right, and bottom-left
    # order
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]], dtype = "float32")
    # compute the perspective transform matrix and then apply it
    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
    return warped

def main():
    image_path = "C:/Users/Tom/.gemini/antigravity/brain/26d22cba-df69-44bb-8c67-225153f5bb47/uploaded_media_1769449740434.jpg"
    image = cv2.imread(image_path)
    if image is None:
        print("Failed to load image")
        return

    # Resize for easier processing
    height, width = image.shape[:2]
    # Keep it reasonably high res for color sampling
    
    # 1. Detect the card contour
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Try edged detection
    edged = cv2.Canny(blurred, 50, 200)
    
    # Find contours
    cnts, _ = cv2.findContours(edged.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cnts = sorted(cnts, key=cv2.contourArea, reverse=True)
    
    card_cnt = None
    for c in cnts[:5]:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        
        if len(approx) == 4:
            card_cnt = approx
            break

    if card_cnt is None:
        print("Could not find card contour")
        # Fallback: maybe use the whole image?
        pts = np.array([[0,0], [width, 0], [width, height], [0, height]], dtype="float32")
    else:
        pts = card_cnt.reshape(4, 2).astype('float32')

    # Warp prespective to get a flat card
    warped = four_point_transform(image, pts)
    
    # Now we have the card. The grid is 14x9.
    # Dimensions
    h, w = warped.shape[:2]
    
    # Grid parameters
    cols = 14
    rows = 9
    
    # The QR code is in the bottom right, 3x3 cells.
    # We should exclude those.
    
    # Calculate cell size
    cell_w = w / cols
    cell_h = h / rows
    
    extracted_data = []
    
    # LPI Range: Left (0) = 2000, Right (13) = 500
    lpi_start = 2000
    lpi_end = 500
    
    # Freq Range: Top (0) = 40, Bottom (8) = 90
    freq_start = 40
    freq_end = 90
    
    for r in range(rows):
        for c in range(cols):
            # Check if this is partially in the QR code zone (last 3 rows, last 3 cols)
            if r >= rows - 3 and c >= cols - 3:
                continue
                
            # Sample center of the cell
            cx = int((c + 0.5) * cell_w)
            cy = int((r + 0.5) * cell_h)
            
            # Sample a small region to be robust against noise
            sample_size = 5
            y1 = max(0, cy - sample_size)
            y2 = min(h, cy + sample_size)
            x1 = max(0, cx - sample_size)
            x2 = min(w, cx + sample_size)
            
            roi = warped[y1:y2, x1:x2]
            avg_color_per_row = np.average(roi, axis=0)
            avg_color = np.average(avg_color_per_row, axis=0)
            
            # Format: R, G, B (OpenCV uses BGR)
            b_val, g_val, r_val = avg_color
            
            # Calculate metrics
            # Linear interpolation
            lpi = lpi_start + (c / (cols - 1)) * (lpi_end - lpi_start)
            freq = freq_start + (r / (rows - 1)) * (freq_end - freq_start)

            extracted_data.append({
                "color": {"r": int(r_val), "g": int(g_val), "b": int(b_val)},
                "frequency": round(freq, 2),
                "lpi": round(lpi, 2),
                "col": c,
                "row": r
            })
            
    # Write directly to JS file
    js_content = "/**\n * Default System Color Map\n * Extracted from calibration card 2026-01-26\n */\n\nexport const DEFAULT_COLOR_MAP_DATA = {\n    freqRange: { min: 40, max: 90 },\n    lpiRange: { min: 500, max: 2000 },\n    entries: " + json.dumps(extracted_data, indent=4) + "\n};\n"
    
    with open('src/lib/default-color-map.js', 'w', encoding='utf-8') as f:
        f.write(js_content)
        
    print("Successfully wrote to src/lib/default-color-map.js")

if __name__ == "__main__":
    main()
