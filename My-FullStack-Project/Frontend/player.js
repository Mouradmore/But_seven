const videoElement = document.getElementById('main-video');
const videoSource = document.createElement('source');
videoElement.appendChild(videoSource);

// دالة لجلب الفيديوهات من الخادم
async function fetchAndLoadVideo(videoId = null) {
  try {
    // إذا تم تمرير ID، اجلب فيديو واحد، وإلا اجلب القائمة كاملة
    const url = videoId ?
      `http://localhost:5000/api/videos/${videoId}` :
      `http://localhost:5000/api/videos`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    let targetVideo;
    
    if (videoId) {
      targetVideo = data;
    } else if (data.videos && data.videos.length > 0) {
      targetVideo = data.videos[0]; // تشغيل أول فيديو افتراضياً
    }
    
    if (targetVideo) {
      // تحديث مصدر الفيديو
      videoSource.src = targetVideo.videoUrl;
      videoElement.load();
      
      // تحديث واجهة المستخدم (تضاف لاحقاً لتغيير العنوان والصورة المصغرة)
      console.log(`تم تحميل: ${targetVideo.title}`);
      
      // تحديث إشعارات النظام (Media Session)
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: targetVideo.title,
          artist: targetVideo.author || 'But_Seven',
          artwork: [{ src: targetVideo.thumbnail, sizes: '512x512', type: 'image/jpeg' }]
        });
      }
    }
  } catch (error) {
    console.error('خطأ في الاتصال بالخادم:', error);
  }
}

// قراءة معرّف الفيديو من الرابط (مثال: player.html?v=vid_001)
const urlParams = new URLSearchParams(window.location.search);
const requestedVideoId = urlParams.get('v');

// استدعاء الدالة عند تحميل الصفحة
window.addEventListener('DOMContentLoaded', () => {
  fetchAndLoadVideo(requestedVideoId);
});
// دالة مساعدة للحصول على التوكن الحالي من مكتبة Firebase المتواجدة في منصتك
async function getAuthToken() {
  // افترضنا أن firebase متاح في النطاق العالمي للمنصة
  const user = firebase.auth().currentUser;
  if (user) {
    return await user.getIdToken();
  }
  return null;
}

// تحديث منطق إرسال التعليق
submitCommentBtn.addEventListener('click', async () => {
  const text = commentInput.value.trim();
  if (!text) return;
  
  const token = await getAuthToken();
  if (!token) {
    alert('يرجى تسجيل الدخول للتعليق على الفيديو');
    return;
  }
  
  try {
    const res = await fetch(`http://localhost:5000/api/interactions/${currentVideoId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // تمرير التوكن الموثق هنا
      },
      body: JSON.stringify({ text: text }) // نرسل النص فقط، السيرفر سيتكفل بالباقي
    });
    
    if (res.ok) {
      commentInput.value = '';
      loadComments();
    } else {
      const errData = await res.json();
      alert(errData.error);
    }
  } catch (error) {
    console.error('خطأ في الإرسال', error);
  }
});

// تحديث منطق الضغط على زر الإعجاب
likeBtn.addEventListener('click', async () => {
  const token = await getAuthToken();
  if (!token) {
    alert('يرجى تسجيل الدخول للإعجاب بالفيديو');
    return;
  }
  
  likeBtn.classList.toggle('liked');
  let currentLikes = parseInt(likesCount.textContent);
  
  if (likeBtn.classList.contains('liked')) {
    likesCount.textContent = currentLikes + 1;
    
    await fetch(`http://localhost:5000/api/interactions/${currentVideoId}/like`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  } else {
    likesCount.textContent = Math.max(0, currentLikes - 1);
    // مسار إلغاء الإعجاب يمكن التعامل معه بنفس الطريقة
  }
});