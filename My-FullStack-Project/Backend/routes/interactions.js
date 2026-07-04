const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const db = admin.firestore();

// 1. مسار لإضافة أو إزالة إعجاب
router.post('/:videoId/like', async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const videoRef = db.collection('videos').doc(videoId);
    
    // استخدام دالة الزيادة التلقائية من Firebase
    await videoRef.update({
      likes: admin.firestore.FieldValue.increment(1)
    });
    
    res.status(200).json({ message: 'تم تسجيل الإعجاب بنجاح' });
  } catch (error) {
    console.error('خطأ في تسجيل الإعجاب:', error);
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
});

// 2. مسار لإضافة تعليق جديد
router.post('/:videoId/comments', async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const { author, text } = req.body;
    
    if (!text || !author) {
      return res.status(400).json({ error: 'يجب توفير النص واسم الكاتب' });
    }
    
    const commentData = {
      author,
      text,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // إضافة التعليق في مجموعة فرعية (Subcollection) داخل مستند الفيديو
    await db.collection('videos').doc(videoId).collection('comments').add(commentData);
    
    res.status(201).json({ message: 'تمت إضافة التعليق بنجاح', comment: commentData });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ أثناء إضافة التعليق' });
  }
});

// 3. مسار لجلب التعليقات الخاصة بفيديو معين
router.get('/:videoId/comments', async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const commentsRef = db.collection('videos').doc(videoId).collection('comments');
    const snapshot = await commentsRef.orderBy('createdAt', 'desc').get();
    
    let comments = [];
    snapshot.forEach(doc => {
      comments.push({ id: doc.id, ...doc.data() });
    });
    
    res.status(200).json({ comments });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب التعليقات' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const db = admin.firestore();
const verifyToken = require('../middleware/auth'); // استدعاء وسيط التحقق

// 1. مسار تسجيل الإعجاب (محمي)
router.post('/:videoId/like', verifyToken, async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const videoRef = db.collection('videos').doc(videoId);
    
    await videoRef.update({
      likes: admin.firestore.FieldValue.increment(1)
    });
    
    res.status(200).json({ message: 'تم تسجيل الإعجاب بنجاح' });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في السيرفر' });
  }
});

// 2. مسار إضافة تعليق جديد (محمي)
router.post('/:videoId/comments', verifyToken, async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'لا يمكن إرسال تعليق فارغ' });
    }
    
    // جلب البيانات مباشرة من req.user الآمنة والقادمة من Firebase Auth
    const commentData = {
      userId: req.user.uid,
      author: req.user.name || req.user.email.split('@')[0], // اسم المستخدم أو بداية إيميله
      avatar: req.user.picture || '', // صورة الحساب إن وجدت
      text: text,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('videos').doc(videoId).collection('comments').add(commentData);
    
    res.status(201).json({ message: 'تمت إضافة التعليق بنجاح', comment: commentData });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ أثناء إضافة التعليق' });
  }
});

// 3. مسار جلب التعليقات (عام - لا يحتاج لـ verifyToken لكي يتمكن الزوار من القراءة)
router.get('/:videoId/comments', async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const commentsRef = db.collection('videos').doc(videoId).collection('comments');
    const snapshot = await commentsRef.orderBy('createdAt', 'desc').get();
    
    let comments = [];
    snapshot.forEach(doc => {
      comments.push({ id: doc.id, ...doc.data() });
    });
    
    res.status(200).json({ comments });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب التعليقات' });
  }
});

module.exports = router;
