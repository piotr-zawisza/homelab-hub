export async function readCyberQRFromFile(file) {
    return new Promise((resolve) => {
        if (typeof jsQR === 'undefined') { 
            console.warn("[System] jsQR library is missing."); 
            return resolve(null); 
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                const cropSize = Math.min(img.width, img.height); 
                
                canvas.width = img.width;
                canvas.height = cropSize;
                ctx.drawImage(img, 0, 0, img.width, cropSize, 0, 0, canvas.width, canvas.height);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                for (let i = 0; i < data.length; i += 4) {
                    data[i] = 255 - data[i];        
                    data[i + 1] = 255 - data[i + 1];
                    data[i + 2] = 255 - data[i + 2];
                }
                ctx.putImageData(imageData, 0, 0);

                const code = jsQR(data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" });

                if (code) {
                    try { 
                        if (code.data.startsWith('fuid:')) {
                            const [, ...parts] = code.data.split(':');
                            const id = parts.join(':');
                            const response = await fetch(`/api/fu-projects/load/${id}`);
                            if (!response.ok) throw new Error("Project not found on server.");
                            const projectData = await response.json();
                            resolve(JSON.stringify(projectData));
                        } else {
                            resolve(LZString.decompressFromBase64(code.data)); 
                        }
                    } catch (err) { 
                        console.error("[System] Payload processing failed.", err);
                        resolve(null); 
                    }
                } else {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}

export function updateQrInDom(qrPayload) {
    const container = document.getElementById('card-qr-container');
    container.innerHTML = '';
    if (!qrPayload || typeof QRious === 'undefined') return;

    const qrCanvas = document.createElement('canvas');
    new QRious({
        element: qrCanvas,
        value: qrPayload,
        size: 400,
        level: 'M',
        background: '#1a3c34',
        foreground: '#dce8df'
    });
    container.appendChild(qrCanvas);
}