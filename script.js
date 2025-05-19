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
    const STICKER_SIZE = 512; // ابعاد مورد نیاز تلگرام
    const MAX_DURATION = 3000; // 3 ثانیه (حداکثر مدت مجاز)
    const MAX_SIZE_KB = 256; // حداکثر حجم مجاز
    const TARGET_FPS = 30; // نرخ فریم هدف
    
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
     * @param {File} file - فایل تصویر
     */
    function validateAndLoadImage(file) {
        // بررسی نوع فایل
        if (!file.type.match('image/png')) {
            showStatus('لطفاً فقط فایل‌های PNG با پس‌زمینه شفاف آپلود کنید.', 'error');
            return;
        }

        const reader = new FileReader();
        
        reader.onload = function(e) {
            uploadedImage = new Image();
            uploadedImage.src = e.target.result;
            
            uploadedImage.onload = function() {
                // بررسی ابعاد تصویر
                if (this.width > STICKER_SIZE || this.height > STICKER_SIZE) {
                    showStatus(
                        `تصویر باید حداکثر ${STICKER_SIZE}×${STICKER_SIZE} پیکسل باشد. 
                        سایز تصویر شما: ${this.width}×${this.height}`,
                        'error'
                    );
                    resetConverter();
                    return;
                }

                // نمایش پیش‌نمایش
                imagePreview.src = this.src;
                imageInfo.textContent = `سایز: ${this.width}×${this.height} پیکسل`;
                
                // فعال کردن دکمه تبدیل
                convertBtn.disabled = false;
                downloadBtn.disabled = true;
                showStatus('تصویر با موفقیت بارگذاری شد. حالا می‌توانید تبدیل را انجام دهید.', 'success');
                videoPreview.src = '';
                videoInfo.textContent = '';
                webmBlob = null;
            };

            uploadedImage.onerror = function() {
                showStatus('خطا در بارگذاری تصویر. لطفاً فایل معتبر دیگری انتخاب کنید.', 'error');
                resetConverter();
            };
        };
        
        reader.readAsDataURL(file);
    }

    /**
     * تبدیل تصویر به استیکر ویدیویی WebM
     */
    async function convertToSticker() {
        if (!uploadedImage) return;
        
        convertBtn.disabled = true;
        showStatus('در حال ایجاد استیکر ویدیویی...', 'processing');
        
        try {
            // ایجاد کانواس با ابعاد مورد نیاز تلگرام
            const canvas = document.createElement('canvas');
            canvas.width = STICKER_SIZE;
            canvas.height = STICKER_SIZE;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            // پاکسازی کانواس (شفاف)
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // محاسبه موقعیت برای قرارگیری تصویر در مرکز
            const offsetX = (STICKER_SIZE - uploadedImage.width) / 2;
            const offsetY = (STICKER_SIZE - uploadedImage.height) / 2;
            
            // رسم تصویر در مرکز کانواس
            ctx.drawImage(uploadedImage, offsetX, offsetY);

            // ==================== تنظیمات MediaRecorder ====================
            const stream = canvas.captureStream(TARGET_FPS);
            const options = {
                mimeType: 'video/webm;codecs=vp9',
                videoBitsPerSecond: 150000, // 150kbps برای تعادل بین کیفیت و حجم
            };

            // بررسی پشتیبانی مرورگر از VP9
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                throw new Error('مرورگر شما از کدک VP9 پشتیبانی نمی‌کند. لطفاً از Chrome یا Edge استفاده کنید.');
            }

            // ایجاد MediaRecorder
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
                        showStatus(
                            `حجم فایل ${fileSizeKB.toFixed(2)}KB است که بیش از حد مجاز (${MAX_SIZE_KB}KB) می‌باشد.`,
                            'error'
                        );
                        return;
                    }
                    
                    // نمایش ویدیوی نتیجه
                    const videoUrl = URL.createObjectURL(webmBlob);
                    videoPreview.src = videoUrl;
                    videoInfo.textContent = `سایز: ${STICKER_SIZE}×${STICKER_SIZE} | حجم: ${formatFileSize(webmBlob.size)} | مدت: 3 ثانیه`;
                    
                    // فعال کردن دکمه دانلود
                    downloadBtn.disabled = false;
                    showStatus(
                        `استیکر با موفقیت ایجاد شد! حجم: ${fileSizeKB.toFixed(2)}KB`,
                        'success'
                    );
                } catch (error) {
                    console.error('خطا در پردازش ویدیو:', error);
                    showStatus('خطا در ایجاد استیکر: ' + error.message, 'error');
                } finally {
                    convertBtn.disabled = false;
                }
            };

            // مدیریت خطاها
            mediaRecorder.onerror = function(e) {
                console.error('خطای MediaRecorder:', e.error);
                showStatus('خطا در ضبط ویدیو: ' + e.error.message, 'error');
                convertBtn.disabled = false;
            };

            // شروع ضبط
            mediaRecorder.start(100); // دریافت داده هر 100 میلی‌ثانیه
            
            // توقف خودکار پس از 3 ثانیه
            setTimeout(() => {
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                    
                    // آزاد کردن منابع
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
     * دانلود استیکر ایجاد شده
     */
    function downloadSticker() {
        if (!webmBlob) return;
        
        const url = URL.createObjectURL(webmBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'telegram-sticker.webm';
        document.body.appendChild(a);
        a.click();
        
        // تمیزکاری
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    // ==================== توابع کمکی ====================

    /**
     * نمایش وضعیت با استایل مناسب
     * @param {string} message - پیام نمایشی
     * @param {string} type - نوع پیام (success, error, processing)
     */
    function showStatus(message, type = 'error') {
        status.textContent = message;
        status.className = 'status';
        
        switch (type) {
            case 'success':
                status.classList.add('success');
                break;
            case 'error':
                status.classList.add('error');
                break;
            case 'processing':
                status.classList.add('processing');
                break;
        }
    }

    /**
     * فرمت کردن حجم فایل برای نمایش
     * @param {number} bytes - حجم فایل به بایت
     * @returns {string} رشته فرمت شده
     */
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * ریست کردن مبدل به حالت اولیه
     */
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

    // بررسی اولیه پشتیبانی از MediaRecorder
    if (!window.MediaRecorder) {
        showStatus('مرورگر شما از قابلیت ضبط ویدیو پشتیبانی نمی‌کند. لطفاً از Chrome، Edge یا Firefox جدید استفاده کنید.', 'error');
        convertBtn.disabled = true;
    }
});