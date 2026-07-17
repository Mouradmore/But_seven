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

// دالة حذف المشروع (DELETE)
app.delete('/api/projects/:id', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        
        if (!project) {
            return res.status(404).json({ msg: 'المشروع غير موجود' });
        }

        // إضافة حماية: التأكد أن المستخدم الذي يحذف هو صاحب المشروع
        if (project.author !== req.user.username) {
            return res.status(401).json({ msg: 'غير مصرح لك بحذف هذا المشروع' });
        }

        await Project.findByIdAndDelete(req.params.id);
        res.json({ msg: 'تم حذف المشروع بنجاح' });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'خطأ داخلي في السيرفر' });
    }
});

// ==========================================
// 3. مسارات الإعجاب (Like Routes)
// ==========================================

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

// ==========================================
// 4. مسارات التقييم (Rating Routes)
// ==========================================

// إضافة/تحديث تقييم المشروع
app.post('/api/projects/:id/rating', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });

        const { rating } = req.body;
        const username = req.user.username;

        // التحقق من صحة التقييم
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ msg: 'التقييم يجب أن يكون بين 1 و 5' });
        }

        // حذف التقييم السابق للمستخدم
        project.ratings = project.ratings.filter(r => r.user !== username);

        // إضافة التقييم الجديد
        project.ratings.push({ user: username, value: rating });

        await project.save();
        res.json(project);
    } catch (err) {
        console.error(err);
        res.status(500).send('خطأ في السيرفر');
    }
});

// جلب تقييمات المشروع
app.get('/api/projects/:id/ratings', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });

        const ratings = project.ratings || [];
        const totalRatings = ratings.length;
        const average = totalRatings > 0 
            ? ratings.reduce((sum, r) => sum + r.value, 0) / totalRatings 
            : 0;

        res.json({
            ratings,
            totalRatings,
            average: parseFloat(average.toFixed(1))
        });
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
});

// ==========================================
// 5. مسارات التعليقات (Comment Routes)
// ==========================================

// إضافة تعليق (Add Comment) -> متوافق مع view.html
app.post('/api/projects/:id/comment', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });

        const newComment = {
            author: req.user.username,
            text: req.body.text,
            createdAt: new Date()
        };

        project.comments.push(newComment);
        await project.save();
        res.json(project); // إرجاع المشروع كاملاً
    } catch (err) {
        console.error(err);
        res.status(500).send('خطأ في السيرفر');
    }
});

// حذف تعليق
app.delete('/api/projects/:projectId/comment/:commentId', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });

        const comment = project.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ msg: 'التعليق غير موجود' });

        // التأكد أن المستخدم هو صاحب التعليق
        if (comment.author !== req.user.username) {
            return res.status(401).json({ msg: 'غير مصرح لك بحذف هذا التعليق' });
        }

        // استخدام pull لإزالة التعليق
        project.comments.pull(req.params.commentId);
        await project.save();
        res.json(project);
    } catch (err) {
        console.error(err);
        res.status(500).send('خطأ في السيرفر');
    }
});

// تحديث تعليق
app.put('/api/projects/:projectId/comment/:commentId', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });

        const comment = project.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ msg: 'التعليق غير موجود' });

        // التأكد أن المستخدم هو صاحب التعليق
        if (comment.author !== req.user.username) {
            return res.status(401).json({ msg: 'غير مصرح لك بتعديل هذا التعليق' });
        }

        comment.text = req.body.text || comment.text;
        await project.save();
        res.json(project);
    } catch (err) {
        console.error(err);
        res.status(500).send('خطأ في السيرفر');
    }
});

// ==========================================
// 6. مسارات الردود (Reply Routes)
// ==========================================

// إضافة رد على تعليق
app.post('/api/projects/:projectId/comment/:commentId/reply', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });

        // البحث عن التعليق
        const comment = project.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ msg: 'التعليق غير موجود' });

        // إضافة الرد
        const newReply = {
            author: req.user.username,
            text: req.body.text,
            createdAt: new Date()
        };

        comment.replies.push(newReply);
        await project.save();
        res.json(project); // إرجاع المشروع كاملاً
    } catch (err) {
        console.error(err);
        res.status(500).send('خطأ في السيرفر');
    }
});

// حذف رد
app.delete('/api/projects/:projectId/comment/:commentId/reply/:replyId', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });

        const comment = project.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ msg: 'التعليق غير موجود' });

        const reply = comment.replies.id(req.params.replyId);
        if (!reply) return res.status(404).json({ msg: 'الرد غير موجود' });

        // التأكد أن المستخدم هو صاحب الرد
        if (reply.author !== req.user.username) {
            return res.status(401).json({ msg: 'غير مصرح لك بحذف هذا الرد' });
        }

        // استخدام pull لإزالة الرد
        comment.replies.pull(req.params.replyId);
        await project.save();
        res.json(project);
    } catch (err) {
        console.error(err);
        res.status(500).send('خطأ في السيرفر');
    }
});

// تحديث رد
app.put('/api/projects/:projectId/comment/:commentId/reply/:replyId', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });

        const comment = project.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ msg: 'التعليق غير موجود' });

        const reply = comment.replies.id(req.params.replyId);
        if (!reply) return res.status(404).json({ msg: 'الرد غير موجود' });

        // التأكد أن المستخدم هو صاحب الرد
        if (reply.author !== req.user.username) {
            return res.status(401).json({ msg: 'غير مصرح لك بتعديل هذا الرد' });
        }

        reply.text = req.body.text || reply.text;
        await project.save();
        res.json(project);
    } catch (err) {
        console.error(err);
        res.status(500).send('خطأ في السيرفر');
    }
});

// ==========================================
// تشغيل الخادم
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 السيرفر يعمل على المنفذ: ${PORT}`));
