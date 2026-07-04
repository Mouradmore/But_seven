require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin'); // إضافة Firebase

const connectDB = require('./config/db');
const User = require('./models/User');
const Project = require('./models/Project');
const auth = require('./middleware/auth');

// ==========================================
// تهيئة Firebase Admin SDK
// ==========================================
// ⚠️ ملاحظة هامة جداً: تأكد من أن ملف firebaseServiceAccount.json موجود فعلاً في مجلد config ومرفوع على Render
const serviceAccount = require('./config/firebaseServiceAccount.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// تهيئة تطبيق Express
const app = express();

// تشغيل دالة الاتصال بقاعدة بيانات MongoDB
connectDB();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// ==========================================
// 1. مسارات المصادقة (Authentication)
// ==========================================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, profilePic } = req.body;
        let userExists = await User.findOne({ $or: [{ email }, { username }] });
        if (userExists) return res.status(400).json({ msg: 'اسم المستخدم أو البريد الإلكتروني مسجل مسبقاً' });
        
        const newUser = new User({ username, email, password, profilePic });
        await newUser.save();
        
        const payload = { user: { id: newUser.id, username: newUser.username } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.json({ token, username: newUser.username, msg: 'تم إنشاء الحساب بنجاح' });
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ msg: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        
        const payload = { user: { id: user.id, username: user.username } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.json({ token, username: user.username, profilePic: user.profilePic });
    } catch (err) {
        console.error(err);
        res.status(500).send('خطأ في السيرفر');
    }
});

// ==========================================
// 2. مسارات المشاريع (Code Projects)
// ==========================================
app.post('/api/projects', auth, async (req, res) => {
    try {
        const { title, description, html, css, js } = req.body;
        const newProject = new Project({ title, description, html, css, js, author: req.user.username });
        await newProject.save();
        res.json(newProject);
    } catch (err) {
        res.status(500).send('خطأ أثناء حفظ المشروع');
    }
});

app.put('/api/projects/:id', auth, async (req, res) => {
    try {
        const projectId = req.params.id;
        let project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });
        if (project.author !== req.user.username) return res.status(401).json({ msg: 'غير مصرح لك بتحديث هذا المشروع' });
        
        project.html = req.body.html || project.html;
        project.css = req.body.css || project.css;
        project.js = req.body.js || project.js;
        
        await project.save();
        res.json({ msg: 'تم التحديث بنجاح', project });
    } catch (err) {
        console.error(err);
        res.status(500).send('خطأ في السيرفر أثناء التحديث');
    }
});

app.get('/api/projects', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const skip = (page - 1) * limit;
        const projects = await Project.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
        const total = await Project.countDocuments();
        res.json({ projects, totalPages: Math.ceil(total / limit), currentPage: page });
    } catch (err) {
        res.status(500).send('خطأ أثناء جلب المشاريع');
    }
});

app.get('/api/projects/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });
        project.views += 1;
        await project.save();
        res.json(project);
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
});

app.delete('/api/projects/:id', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });
        if (project.author !== req.user.username) return res.status(401).json({ msg: 'غير مصرح لك بحذف هذا المشروع' });
        
        await Project.findByIdAndDelete(req.params.id);
        res.json({ msg: 'تم حذف المشروع بنجاح' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'خطأ داخلي في السيرفر' });
    }
});

app.post('/api/projects/:id/like', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });
        
        const username = req.user.username;
        if (project.likes.includes(username)) {
            project.likes = project.likes.filter(user => user !== username);
        } else {
            project.likes.push(username);
        }
        await project.save();
        res.json({ likesCount: project.likes.length, liked: project.likes.includes(username) });
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
});

app.post('/api/projects/:id/comment', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });
        const newComment = { author: req.user.username, text: req.body.text };
        project.comments.push(newComment);
        await project.save();
        res.json(project.comments);
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
});

// ==========================================
// 3. مسارات مشغل الفيديو (Videos & Interactions)
// ==========================================
// ==========================================
// 3. مسارات مشغل الفيديو (Videos API) مدمجة مباشرة
// ==========================================

// 1. مسار الصفحة الرئيسية (يجب أن يكون في الأعلى)
app.get('/api/videos/homepage', async (req, res) => {
    try {
        const videosRef = admin.firestore().collection('videos');
        
        const latestSnapshot = await videosRef.orderBy('createdAt', 'desc').limit(10).get();
        let latest = [];
        latestSnapshot.forEach(doc => latest.push({ id: doc.id, ...doc.data() }));
        
        const popularSnapshot = await videosRef.orderBy('views', 'desc').limit(10).get();
        let popular = [];
        popularSnapshot.forEach(doc => popular.push({ id: doc.id, ...doc.data() }));
        
        const suggestedSnapshot = await videosRef.where('isSuggested', '==', true).limit(10).get();
        let suggested = [];
        suggestedSnapshot.forEach(doc => suggested.push({ id: doc.id, ...doc.data() }));
        
        res.status(200).json({ latest, popular, suggested });
    } catch (error) {
        console.error('خطأ:', error);
        res.status(500).json({ error: 'حدث خطأ في الخادم' });
    }
});

// 2. مسار البحث الفوري
app.get('/api/videos/search', async (req, res) => {
    try {
        const query = req.query.q ? req.query.q.toLowerCase() : '';
        if (!query) return res.status(200).json({ videos: [] });
        
        const snapshot = await admin.firestore().collection('videos').get();
        let results = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const title = (data.title || '').toLowerCase();
            const desc = (data.description || '').toLowerCase();
            if (title.includes(query) || desc.includes(query)) {
                results.push({ id: doc.id, ...data });
            }
        });
        res.status(200).json({ videos: results });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// 3. مسار جلب القائمة الجانبية (Related)
app.get('/api/videos/:id/related', async (req, res) => {
    try {
        const currentId = req.params.id;
        const snapshot = await admin.firestore().collection('videos').orderBy('createdAt', 'desc').limit(15).get();
        let relatedVideos = [];
        snapshot.forEach(doc => {
            if (doc.id !== currentId) {
                relatedVideos.push({ id: doc.id, ...doc.data() });
            }
        });
        res.status(200).json({ videos: relatedVideos });
    } catch (error) {
        res.status(500).json({ error: 'خطأ' });
    }
});

// 4. مسار جلب تفاصيل فيديو واحد بواسطة ID (يجب أن يكون في الأسفل دائماً)
app.get('/api/videos/:id', async (req, res) => {
    try {
        const videoDoc = await admin.firestore().collection('videos').doc(req.params.id).get();
        if (!videoDoc.exists) return res.status(404).json({ message: 'الفيديو غير موجود' });
        
        await videoDoc.ref.update({ views: admin.firestore.FieldValue.increment(1) });
        res.status(200).json({ id: videoDoc.id, ...videoDoc.data() });
    } catch (error) {
        res.status(500).json({ error: 'خطأ' });
    }
});

// ==========================================
// تشغيل الخادم
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل بنجاح على المنفذ: ${PORT}`);
});
