document.addEventListener('DOMContentLoaded', function() {
    // عناصر DOM
    const fileInput = document.getElementById('fileInput');
    const dropArea = document.getElementById('dropArea');
    const imagePreview = document.getElementById('imagePreview');
    const videoPreview = document.getElementById('videoPreview');
    const convertBtn = document.getElementById('convertBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const status = document.getElementById('status');
    const imageInfo = document.getElementById('imageInfo');
    const videoInfo = document.getElementById('videoInfo');
    
    // تنظیمات ثابت برای استیکر تلگرام
    const STICKER_SIZE = 512;
    const MAX_DURATION = 3000;
    const MAX_SIZE_KB = 256;
    const TARGET_FPS = 30;

    // متغیرهای حالت
    let uploadedImage = null;
    let webmBlob = null;
    let mediaRecorder = null;

    // ==================== رویدادهای Drag and Drop ====================
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('drag-over');
    });
    
    dropArea.addEventListener('dragleave', () => {
        dropArea.classList.remove('drag-over');
    });
    
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('drag-over');
        
        if (e.dataTransfer.files.length) {
            const file = e.dataTransfer.files[0];
            validateAndLoadImage(file);
        }
    });

    // ==================== رویداد انتخاب فایل ====================
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            const file = fileInput.files[0];
            validateAndLoadImage(file);
        }
    });

    // ==================== توابع اصلی ====================

    /**
     * بررسی و بارگذاری تصویر
     */
    function validateAndLoadImage(file) {
        // بررسی نوع فایل
        if (!file.type.match('image.*')) {
            showStatus('لطفاً فقط فایل‌های تصویری آپلود کنید.', 'error');
            return;
        }

        const reader = new FileReader();
        
        reader.onload = function(e) {
            uploadedImage = new Image();
            uploadedImage.src = e.target.result;
            
            uploadedImage.onload = function() {
                // نمایش پیش‌نمایش
                imagePreview.src = this.src;
                imageInfo.textContent = `سایز اصلی: ${this.width}×${this.height} پیکسل`;
                
                // فعال کردن دکمه تبدیل
                convertBtn.disabled = false;
                downloadBtn.disabled = true;
                showStatus('تصویر با موفقیت بارگذاری شد.', 'success');
                videoPreview.src = '';
                videoInfo.textContent = '';
                webmBlob = null;
            };

            uploadedImage.onerror = function() {
                showStatus('خطا در بارگذاری تصویر.', 'error');
                resetConverter();
            };
        };
        
        reader.readAsDataURL(file);
    }

    /**
     * تبدیل تصویر به ابعاد 512x512 با حفظ نسبت و اضافه کردن پس‌زمینه شفاف
     */
    function resizeImageWithTransparentBg(image) {
        const canvas = document.createElement('canvas');
        canvas.width = STICKER_SIZE;
        canvas.height = STICKER_SIZE;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        // ایجاد پس‌زمینه شفاف
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // محاسبه نسبت و موقعیت جدید برای حفظ تناسب
        const ratio = Math.min(
            STICKER_SIZE / image.width,
            STICKER_SIZE / image.height
        );
        
        const newWidth = image.width * ratio;
        const newHeight = image.height * ratio;
        
        const offsetX = (STICKER_SIZE - newWidth) / 2;
        const offsetY = (STICKER_SIZE - newHeight) / 2;
        
        // رسم تصویر با حفظ تناسب و در مرکز کانواس
        ctx.drawImage(
            image,
            offsetX, offsetY,
            newWidth, newHeight
        );
        
        return canvas;
    }

    /**
     * بررسی وجود پیکسل‌های شفاف در تصویر
     */
    function hasTransparency(imageData) {
        for (let i = 3; i < imageData.data.length; i += 4) {
            if (imageData.data[i] < 255) {
                return true;
            }
        }
        return false;
    }

    /**
     * تبدیل تصویر به استیکر ویدیویی
     */
    async function convertToSticker() {
        if (!uploadedImage) return;
        
        convertBtn.disabled = true;
        showStatus('در حال ایجاد استیکر...', 'processing');
        
        try {
            // تبدیل ابعاد و اضافه کردن پس‌زمینه شفاف
            const canvas = resizeImageWithTransparentBg(uploadedImage);
            const ctx = canvas.getContext('2d');
            
            // بررسی شفافیت تصویر
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const isTransparent = hasTransparency(imageData);
            
            if (!isTransparent) {
                showStatus('توجه: تصویر پس‌زمینه شفاف ندارد. پس‌زمینه شفاف اضافه شد.', 'info');
            }

            // ==================== تنظیمات MediaRecorder ====================
            const stream = canvas.captureStream(TARGET_FPS);
            const options = {
                mimeType: 'video/webm;codecs=vp9',
                videoBitsPerSecond: 150000,
            };

            // بررسی پشتیبانی مرورگر از VP9
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                throw new Error('مرورگر شما از کدک VP9 پشتیبانی نمی‌کند.');
            }

            mediaRecorder = new MediaRecorder(stream, options);
            const chunks = [];
            
            mediaRecorder.ondataavailable = function(e) {
                chunks.push(e.data);
            };
            
            mediaRecorder.onstop = async function() {
                try {
                    webmBlob = new Blob(chunks, { type: 'video/webm' });
                    
                    // بررسی حجم فایل
                    const fileSizeKB = webmBlob.size / 1024;
                    if (fileSizeKB > MAX_SIZE_KB) {
                        showStatus(`حجم فایل ${fileSizeKB.toFixed(2)}KB است. برای کاهش حجم، کیفیت تصویر را پایین بیاورید.`, 'error');
                        return;
                    }
                    
                    // نمایش نتیجه
                    const videoUrl = URL.createObjectURL(webmBlob);
                    videoPreview.src = videoUrl;
                    videoInfo.textContent = `سایز: ${STICKER_SIZE}×${STICKER_SIZE} | حجم: ${fileSizeKB.toFixed(2)}KB | مدت: 3 ثانیه`;
                    
                    downloadBtn.disabled = false;
                    showStatus(`استیکر آماده است! (${fileSizeKB.toFixed(2)}KB)`, 'success');
                } catch (error) {
                    console.error('خطا در پردازش ویدیو:', error);
                    showStatus('خطا در ایجاد استیکر: ' + error.message, 'error');
                } finally {
                    convertBtn.disabled = false;
                }
            };

            mediaRecorder.onerror = function(e) {
                console.error('خطای MediaRecorder:', e.error);
                showStatus('خطا در ضبط ویدیو.', 'error');
                convertBtn.disabled = false;
            };

            // شروع ضبط
            mediaRecorder.start(100);
            
            // توقف خودکار پس از 3 ثانیه
            setTimeout(() => {
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                    stream.getTracks().forEach(track => track.stop());
                }
            }, MAX_DURATION);

        } catch (error) {
            console.error('خطا در تبدیل:', error);
            showStatus('خطا در ایجاد استیکر: ' + error.message, 'error');
            convertBtn.disabled = false;
        }
    }

    /**
     * دانلود استیکر
     */
    function downloadSticker() {
        if (!webmBlob) return;
        
        const url = URL.createObjectURL(webmBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'telegram-sticker.webm';
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    // ==================== توابع کمکی ====================

    function showStatus(message, type = 'error') {
        status.textContent = message;
        status.className = 'status ' + type;
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function resetConverter() {
        convertBtn.disabled = true;
        downloadBtn.disabled = true;
        imagePreview.src = '';
        videoPreview.src = '';
        imageInfo.textContent = '';
        videoInfo.textContent = '';
        webmBlob = null;
        uploadedImage = null;
    }

    // ==================== رویدادهای دکمه‌ها ====================
    convertBtn.addEventListener('click', convertToSticker);
    downloadBtn.addEventListener('click', downloadSticker);

    // بررسی پشتیبانی مرورگر
    if (!window.MediaRecorder) {
        showStatus('مرورگر شما از این قابلیت پشتیبانی نمی‌کند.', 'error');
        convertBtn.disabled = true;
    }
});