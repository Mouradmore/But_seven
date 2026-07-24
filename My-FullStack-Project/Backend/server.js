const connectDB = require('./config/db');
// تشغيل دالة الاتصال بقاعدة البيانات
connectDB();
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('./models/User');
const Project = require('./models/Project');
const auth = require('./middleware/auth');

const app = express();

// Middleware لتمكين استقبال بيانات JSON وضمان عدم حظر الطلبات (CORS)
app.use(express.json({ limit: '50mb' })); // زيادة الحجم لاستيعاب الـ Base64 للصور والأكواد
app.use(cors());

// الاتصال بقاعدة بيانات MongoDB


// ==========================================
// 1. مسارات المصادقة (Authentication Routes)
// ==========================================

// التسجيل (Register) -> متوافق مع register.html
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, profilePic } = req.body;

        let userExists = await User.findOne({ $or: [{ email }, { username }] });
        if (userExists) return res.status(400).json({ msg: 'اسم المستخدم أو البريد الإلكتروني مسجل مسبقاً' });

        const newUser = new User({ username, email, password, profilePic });
        await newUser.save();

        // إنشاء التوكن الخاص بالمستخدم لتسجيل دخوله فوراً
        const payload = { user: { id: newUser.id, username: newUser.username } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({ token, username: newUser.username, msg: 'تم إنشاء الحساب بنجاح' });
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
});

// تسجيل الدخول (Login) -> متوافق مع indexs.html
// ==========================================
// مسار تسجيل الدخول (Login) بعد التعديل
// ==========================================
// تسجيل الدخول (Login) 
app.post('/api/auth/login', async (req, res) => {
    try {
        // نستقبل اسم المستخدم وليس الإيميل لتتوافق مع الواجهة
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ msg: 'اسم المستخدم أو كلمة المرور غير صحيحة' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'اسم المستخدم أو كلمة المرور غير صحيحة' });

        const payload = { user: { id: user.id, username: user.username } };
        
        // إنشاء التوكن
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        // التعديل هنا فقط: إضافة profilePic للبيانات المرسلة
        res.json({ 
            token, 
            username: user.username, 
            profilePic: user.profilePic 
        });
        
    } catch (err) {
        console.error(err);
        res.status(500).send('خطأ في السيرفر');
    }
});

// ==========================================
// 2. مسارات المشاريع (Projects Routes)
// ==========================================

// نشر مشروع جديد (Create Project) -> متوافق مع codes.html
app.post('/api/projects', auth, async (req, res) => {
    try {
        const { title, description, html, css, js } = req.body;

        const newProject = new Project({
            title,
            description,
            html,
            css,
            js,
            author: req.user.username
        });

        await newProject.save();
        res.json(newProject);

    } catch (err) {
        res.status(500).send('خطأ أثناء حفظ المشروع');
    }
});
// تحديث مشروع موجود (Update Project)
app.put('/api/projects/:id', auth, async (req, res) => {
    try {
        const projectId = req.params.id;
        
        // التحقق من أن المشروع موجود
        let project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });
        
        // التأكد أن من يقوم بتحديثه هو صاحبه الفعلي
        if (project.author !== req.user.username) {
            return res.status(401).json({ msg: 'غير مصرح لك بتحديث هذا المشروع' });
        }

        // تحديث الكود
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
// جلب كافة المشاريع مع الترقيم (Get Projects with Pagination) -> متوافق مع indexs.html
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

// جلب مشروع واحد للمعاينة (Get Single Project) -> متوافق مع view.html
app.get('/api/projects/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });
        
        // زيادة عدد المشاهدات عند الفتح
        project.views += 1;
        await project.save();
        
        res.json(project);
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
});
// ... (الكود السابق في ملفك)

// دالة حذف المشروع (DELETE)
app.delete('/api/projects/:id', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        
        if (!project) {
            return res.status(404).json({ msg: 'المشروع غير موجود' });
        }
        
        if (project.author !== req.user.username) {
            return res.status(403).json({ msg: 'غير مصرح لك بحذف هذا المشروع' });
        }
        
        await Project.findByIdAndDelete(req.params.id);
        
        // إرجاع معلومات واضحة
        res.json({
            msg: 'تم حذف المشروع بنجاح',
            deletedId: req.params.id,
            success: true
        });
        
    } catch (error) {
        console.error('خطأ في الحذف:', error);
        res.status(500).json({
            msg: 'خطأ داخلي في السيرفر أثناء الحذف',
            error: error.message,
            success: false
        });
    }
});

// ... (تكملة الكود الخاص بمسارات الإعجاب والتعليقات)
// الإعجاب وإلغاء الإعجاب بمشروع (Like / Unlike) -> متوافق مع view.html
app.post('/api/projects/:id/like', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });

        const username = req.user.username;
        if (project.likes.includes(username)) {
            // إذا كان مسجلاً في قائمة المعجبين، نقوم بإلغاء الإعجاب
            project.likes = project.likes.filter(user => user !== username);
        } else {
            // إذا لم يكن معجباً، نضيفه
            project.likes.push(username);
        }

        await project.save();
        res.json({ likesCount: project.likes.length, liked: project.likes.includes(username) });
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
});

// إضافة تعليق (Add Comment) -> متوافق مع view.html
app.post('/api/projects/:id/comment', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });

        const newComment = {
            author: req.user.username,
            text: req.body.text
        };

        project.comments.push(newComment);
        await project.save();
        res.json(project.comments);
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
});

// تشغيل الخادم
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 السيرفر يعمل على المنفذ: ${PORT}`));
// ==========================================
// مسار تجديد التوكن
// ==========================================
app.post('/api/auth/refresh', async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.findOne({ username });
        
        if (!user) {
            return res.status(404).json({ msg: 'المستخدم غير موجود' });
        }
        
        const payload = { user: { id: user.id, username: user.username } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.json({ token });
    } catch (err) {
        res.status(500).json({ msg: 'خطأ في تجديد التوكن' });
    }
});
