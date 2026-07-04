const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const db = admin.firestore();

// 1. مسار الصفحة الرئيسية (مقسمة: أحدث، أكثر مشاهدة، مقترحة)
// GET /api/videos/homepage
router.get('/homepage', async (req, res) => {
    try {
        const videosRef = db.collection('videos');
        
        const latestSnapshot = await videosRef.orderBy('createdAt', 'desc').limit(10).get();
        let latest = [];
        latestSnapshot.forEach(doc => latest.push({ id: doc.id, ...doc.data() }));

        const popularSnapshot = await videosRef.orderBy('views', 'desc').limit(10).get();
        let popular = [];
        popularSnapshot.forEach(doc => popular.push({ id: doc.id, ...doc.data() }));

        const suggestedSnapshot = await videosRef.where('isSuggested', '==', true).limit(10).get();
        let suggested = [];
        suggestedSnapshot.forEach(doc => suggested.push({ id: doc.id, ...doc.data() }));

        // يجب أن تتطابق هذه المفاتيح (latest, popular, suggested) مع ما يقرأه home.html
        res.status(200).json({ latest, popular, suggested });
    } catch (error) {
        console.error('Error fetching homepage videos:', error);
        res.status(500).json({ error: 'حدث خطأ في الخادم أثناء جلب بيانات الرئيسية' });
    }
});

// 2. مسار البحث الفوري
// GET /api/videos/search?q=...
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q ? req.query.q.toLowerCase() : '';
        if (!query) {
            return res.status(200).json({ videos: [] });
        }

        const snapshot = await db.collection('videos').get();
        let results = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const title = (data.title || '').toLowerCase();
            const description = (data.description || '').toLowerCase();

            if (title.includes(query) || description.includes(query)) {
                results.push({ id: doc.id, ...data });
            }
        });

        res.status(200).json({ videos: results });
    } catch (error) {
        console.error('Error in search:', error);
        res.status(500).json({ error: 'خطأ في الخادم أثناء البحث' });
    }
});

// 3. مسار جلب كافة الفيديوهات (عند عدم تمرير ID محدد)
// GET /api/videos
router.get('/', async (req, res) => {
    try {
        const snapshot = await db.collection('videos').orderBy('createdAt', 'desc').get();
        let videos = [];
        snapshot.forEach(doc => videos.push({ id: doc.id, ...doc.data() }));
        
        res.status(200).json({ videos });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في جلب الفيديوهات' });
    }
});

// 4. مسار جلب القائمة الجانبية (الفيديوهات ذات الصلة باستثناء الحالي)
// GET /api/videos/:id/related
router.get('/:id/related', async (req, res) => {
    try {
        const currentVideoId = req.params.id;
        const snapshot = await db.collection('videos').orderBy('createdAt', 'desc').limit(15).get();
        
        let relatedVideos = [];
        snapshot.forEach(doc => {
            if (doc.id !== currentVideoId) {
                relatedVideos.push({ id: doc.id, ...doc.data() });
            }
        });

        res.status(200).json({ videos: relatedVideos });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في جلب القائمة الجانبية' });
    }
});

// 5. مسار جلب فيديو واحد بواسطة الـ ID
// GET /api/videos/:id
router.get('/:id', async (req, res) => {
    try {
        const videoId = req.params.id;
        const videoDoc = await db.collection('videos').doc(videoId).get();

        if (!videoDoc.exists) {
            return res.status(404).json({ message: 'الفيديو غير موجود' });
        }

        // زيادة المشاهدات تلقائياً عند طلب الفيديو (اختياري)
        await videoDoc.ref.update({
            views: admin.firestore.FieldValue.increment(1)
        });

        // يرجع البيانات مباشرة ككائن (Object) ليتوافق مع targetVideo في الواجهة
        res.status(200).json({ id: videoDoc.id, ...videoDoc.data() });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في جلب تفاصيل الفيديو' });
    }
});

module.exports = router;
