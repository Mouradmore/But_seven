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
const videoRoutes = require('./routes/videos');
app.use('/api/videos', videoRoutes);

const interactionRoutes = require('./routes/interactions');
app.use('/api/interactions', interactionRoutes);

// ==========================================
// تشغيل الخادم
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل بنجاح على المنفذ: ${PORT}`);
});
