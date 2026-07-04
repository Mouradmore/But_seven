const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const db = admin.firestore();

// مسار لجلب جميع الفيديوهات أو فيديو محدد
router.get('/', async (req, res) => {
  try {
    const videosRef = db.collection('videos');
    const snapshot = await videosRef.orderBy('createdAt', 'desc').get();
    
    if (snapshot.empty) {
      return res.status(404).json({ message: 'لا توجد فيديوهات متاحة حالياً.' });
    }
    
    let videos = [];
    snapshot.forEach(doc => {
      videos.push({ id: doc.id, ...doc.data() });
    });
    
    res.status(200).json({ videos });
  } catch (error) {
    console.error('خطأ في جلب الفيديوهات:', error);
    res.status(500).json({ error: 'حدث خطأ داخلي في الخادم' });
  }
});

// مسار لجلب تفاصيل فيديو واحد بواسطة الـ ID
router.get('/:id', async (req, res) => {
  try {
    const videoId = req.params.id;
    const videoDoc = await db.collection('videos').doc(videoId).get();
    
    if (!videoDoc.exists) {
      return res.status(404).json({ message: 'الفيديو غير موجود.' });
    }
    
    res.status(200).json({ id: videoDoc.id, ...videoDoc.data() });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب تفاصيل الفيديو' });
  }
});

module.exports = router;
// مسار جلب فيديوهات الصفحة الرئيسية مقسمة حسب الأقسام
router.get('/homepage', async (req, res) => {
  try {
    const videosRef = db.collection('videos');
    
    // 1. جلب أحدث الفيديوهات (مرتبة حسب تاريخ الإنشاء)
    const latestSnapshot = await videosRef.orderBy('createdAt', 'desc').limit(10).get();
    let latestVideos = [];
    latestSnapshot.forEach(doc => latestVideos.push({ id: doc.id, ...doc.data() }));
    
    // 2. جلب الأكثر مشاهدة (مرتبة حسب عدد المشاهدات)
    const popularSnapshot = await videosRef.orderBy('views', 'desc').limit(10).get();
    let popularVideos = [];
    popularSnapshot.forEach(doc => popularVideos.push({ id: doc.id, ...doc.data() }));
    
    // 3. الفيديوهات المقترحة (يمكن تخصيص المنطق لاحقاً، حالياً سنعتمد على اختيار عشوائي أو وسم معين)
    const suggestedSnapshot = await videosRef.where('isSuggested', '==', true).limit(10).get();
    let suggestedVideos = [];
    suggestedSnapshot.forEach(doc => suggestedVideos.push({ id: doc.id, ...doc.data() }));
    
    // إرسال البيانات مجمعة
    res.status(200).json({
      latest: latestVideos,
      popular: popularVideos,
      suggested: suggestedVideos
    });
  } catch (error) {
    console.error('خطأ في جلب بيانات الصفحة الرئيسية:', error);
    res.status(500).json({ error: 'حدث خطأ في الخادم أثناء جلب البيانات' });
  }
});
// مسار البحث الفوري
router.get('/search', async (req, res) => {
  try {
    // استقبال كلمة البحث وتحويلها لأحرف صغيرة لضمان دقة المطابقة
    const query = req.query.q ? req.query.q.toLowerCase() : '';
    
    if (!query) {
      return res.status(200).json({ videos: [] });
    }
    
    const videosRef = db.collection('videos');
    const snapshot = await videosRef.get();
    let results = [];
    
    // فلترة الفيديوهات في السيرفر بناءً على العنوان أو الوصف
    snapshot.forEach(doc => {
      const data = doc.data();
      const title = (data.title || '').toLowerCase();
      const description = (data.description || '').toLowerCase();
      
      // إذا كانت كلمة البحث موجودة في العنوان أو الوصف، أضف الكارت للنتائج
      if (title.includes(query) || description.includes(query)) {
        results.push({ id: doc.id, ...data });
      }
    });
    
    res.status(200).json({ videos: results });
  } catch (error) {
    console.error('خطأ في عملية البحث:', error);
    res.status(500).json({ error: 'حدث خطأ في الخادم أثناء البحث' });
  }
});
// backend/routes/videos.js

// مسار جلب قائمة التشغيل الجانبية (الفيديوهات ذات الصلة)
router.get('/:id/related', async (req, res) => {
  try {
    const currentVideoId = req.params.id;
    const videosRef = db.collection('videos');
    
    // جلب أحدث الفيديوهات كمقترحات (يمكنك لاحقاً تغيير المنطق ليعتمد على التصنيف tags)
    const snapshot = await videosRef.orderBy('createdAt', 'desc').limit(15).get();
    
    let relatedVideos = [];
    snapshot.forEach(doc => {
      // استبعاد الفيديو الحالي من القائمة
      if (doc.id !== currentVideoId) {
        relatedVideos.push({ id: doc.id, ...doc.data() });
      }
    });
    
    res.status(200).json({ videos: relatedVideos });
  } catch (error) {
    console.error('خطأ في جلب قائمة التشغيل:', error);
    res.status(500).json({ error: 'حدث خطأ في الخادم' });
  }
});
