import React from 'react';
import { ShareCertificateFieldData } from '../../../main/services/renderers/share_cert/certificateFields';
import { MASTER_GEOMETRY } from '../../../main/services/renderers/share_cert/certificateGeometry';

interface Props {
  data: ShareCertificateFieldData;
}

export const ShareCertificateFront: React.FC<Props> = () => {
  return (
    <div
      style={{
        position: 'relative',
        width: '1368px',
        height: '936px',
        background: '#ffffff',
        fontFamily: 'serif',
        overflow: 'hidden',
      }}
    >
      {/* Safe Area Marker */}
      <div
        style={{
          position: 'absolute',
          left: `${MASTER_GEOMETRY.MARGIN}px`,
          top: `${MASTER_GEOMETRY.MARGIN}px`,
          width: `${MASTER_GEOMETRY.SAFE_W}px`,
          height: `${MASTER_GEOMETRY.SAFE_H}px`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
