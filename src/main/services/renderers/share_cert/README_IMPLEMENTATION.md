# HENU OS — Share Certificate Master Rebuild Specification

## 1. Physical Specifications
- **Sheet Dimensions**: 19.00 inches wide × 13.00 inches high (1368 pt × 936 pt).
- **Orientation**: Landscape.
- **Stock**: 350 GSM Art Card / Gloss Coated.
- **Safe Margin**: 0.67 inches (48 pt) on all four sides.
- **Safe Rectangle**: x = 48, y = 48, width = 1272 pt, height = 840 pt.

## 2. Front Geometry (`FRONT`)
- **Left Acknowledgement Strip**: Width = 180 pt, Height = 840 pt.
  - Header with red ribbon, Society name, Legal subheading, "ACKNOWLEDGEMENT".
  - Exactly **3 stacked receiver boxes** with rounded corners.
- **Society Copy Panel**: Width = 537 pt, Height = 840 pt.
- **Member Copy Panel**: Width = 537 pt, Height = 840 pt.
- **Multi-line Red Ornamental Guilloche Border**: Thin outer red line + Gold line + Ornamental cross-hatch + Inner red line + 4 Gold/Red corner diamonds.
- **Certificate Content Structure**:
  1. Top metadata row: Serial No., Share Certificate No., Member's Register No., No. of Shares, Flat No.
  2. Dark Red Ornate Ribbon: "Share Certificate"
  3. Authorised Share Capital line
  4. Large Bold Red Society Name
  5. Bold Red Society Subheading
  6. Blue Society Address line
  7. Registration Act line
  8. Red Registration Number & Date line
  9. Certification statement with full underline for member name
  10. 4-line Registered Holders paragraph
  11. Dark ₹ Value Box + Common seal issue date statement
  12. Old Certificate clause box with 3 Owner Underlines (1st, 2nd, 3rd)
  13. Seal of the Society at lower-left
  14. 3 Signature lines at lower-right (Hon. Chairman, Hon. Secretary, Authorised M.C. Member)
  15. Footer: "SOCIETY COPY" / "MEMBER COPY" + "P.T.O."

## 3. Back Geometry (`BACK`)
- **Left Transfer Memo Panel (Society Copy)**: Width = 537 pt, Height = 840 pt.
- **Center Transfer Memo Panel (Member Copy)**: Width = 537 pt, Height = 840 pt.
- **Right Acknowledgement Strip**: Width = 180 pt, Height = 840 pt.
  - Exactly **5 stacked receiver boxes**.
- **Transfer Memo Columns**:
  1. Date of transfer (58 pt)
  2. Transfer No. (46 pt)
  3. Register No. of transfer (62 pt)
  4. To whom Transferred (303 pt) — includes central circular SEAL stamp + 3 signature lines
  5. Register No. of transferee (68 pt)
- Exactly **5 transfer rows** per panel.

## 4. Technology
- Pure programmatic rendering using `pdf-lib` and `fontkit`.
- NO CSS Grid, NO HTML tables, NO percentage reflow. Absolute physical positioning.
