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
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// ==========================================
// 1. مسارات المصادقة (Authentication Routes)
// ==========================================

// التسجيل (Register)
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

// تسجيل الدخول (Login)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ msg: 'اسم المستخدم أو كلمة المرور غير صحيحة' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'اسم المستخدم أو كلمة المرور غير صحيحة' });

        const payload = { user: { id: user.id, username: user.username } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

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

// نشر مشروع جديد
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

// تحديث مشروع موجود
app.put('/api/projects/:id', auth, async (req, res) => {
    try {
        const projectId = req.params.id;

        let project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });

        if (project.author !== req.user.username) {
            return res.status(401).json({ msg: 'غير مصرح لك بتحديث هذا المشروع' });
        }

        project.html = req.body.html || project.html;
        project.css = req.body.css || project.css;
        project.js = req.body.js || project.js;
        project.title = req.body.title || project.title;
        project.description = req.body.description || project.description;
        project.updatedAt = new Date();

        await project.save();
        res.json({ msg: 'تم التحديث بنجاح', project });
    } catch (err) {
        console.error(err);
        res.status(500).send('خطأ في السيرفر أثناء التحديث');
    }
});

// جلب كافة المشاريع مع الترقيم
app.get('/api/projects', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const skip = (page - 1) * limit;

        const projects = await Project.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 }).skip(skip).limit(limit);
        const total = await Project.countDocuments({ isDeleted: { $ne: true } });

        res.json({ projects, totalPages: Math.ceil(total / limit), currentPage: page });
    } catch (err) {
        res.status(500).send('خطأ أثناء جلب المشاريع');
    }
});

// جلب مشروع واحد للمعاينة
app.get('/api/projects/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });
        if (project.isDeleted) return res.status(404).json({ msg: 'المشروع غير موجود' });

        project.views += 1;
        await project.save();

        res.json(project);
    } catch (err) {
        res.status(500).send('خطأ في السيرفر');
    }
});

// حذف المشروع (حذف نهائي)
app.delete('/api/projects/:id', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ msg: 'المشروع غير موجود' });
        }

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
// 3. مسارات سلة المحذوفات (Soft Delete)
// ==========================================

// حذف منطقي - نقل إلى سلة المحذوفات
app.put('/api/projects/:id/soft-delete', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });
        if (project.author !== req.user.username) {
            return res.status(401).json({ msg: 'غير مصرح لك بحذف هذا المشروع' });
        }

        project.isDeleted = true;
        project.deletedAt = new Date();
        await project.save();
        res.json({ msg: 'تم نقل المشروع إلى سلة المحذوفات', project });
    } catch (err) {
        console.error(err);
        res.status(500).send('خطأ في السيرفر');
    }
});

// استعادة مشروع من سلة المحذوفات
app.put('/api/projects/:id/restore', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });
        if (project.author !== req.user.username) {
            return res.status(401).json({ msg: 'غير مصرح لك باستعادة هذا المشروع' });
        }

        project.isDeleted = false;
        project.deletedAt = null;
        await project.save();
        res.json({ msg: 'تم استعادة المشروع بنجاح', project });
    } catch (err) {
        console.error(err);
        res.status(500).send('خطأ في السيرفر');
    }
});

// جلب المشاريع المحذوفة
app.get('/api/projects/deleted/list', auth, async (req, res) => {
    try {
        const projects = await Project.find({ 
            author: req.user.username, 
            isDeleted: true 
        }).sort({ deletedAt: -1 });
        res.json(projects);
    } catch (err) {
        console.error(err);
        res.status(500).send('خطأ في السيرفر');
    }
});

// ==========================================
// 4. مسارات الإعجاب (Likes)
// ==========================================

// الإعجاب وإلغاء الإعجاب بمشروع
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

// ==========================================
// 5. مسارات التعليقات والردود (Comments & Replies)
// ==========================================

// ✅ إضافة تعليق
app.post('/api/projects/:id/comment', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });

        const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
        if (!text) return res.status(400).json({ msg: 'نص التعليق مطلوب' });

        project.comments = project.comments || [];
        project.comments.push({
            author: req.user.username,
            text,
            createdAt: new Date(),
            replies: []
        });

        project.markModified('comments'); // 🔴 إجبار Mongoose على حفظ التعديل

        await project.save();
        res.json(project);
    } catch (err) {
        console.error('Add comment error:', err);
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
});

// ✅ إضافة رد على تعليق
app.post('/api/projects/:id/comment/:commentId/reply', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });

        const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
        if (!text) return res.status(400).json({ msg: 'نص الرد مطلوب' });

        const comment = project.comments && project.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ msg: 'التعليق غير موجود' });

        comment.replies = comment.replies || [];
        comment.replies.push({
            author: req.user.username,
            text,
            createdAt: new Date()
        });

        project.markModified('comments'); // 🔴 إجبار Mongoose على حفظ التعديل

        await project.save();
        res.json(project);
    } catch (err) {
        console.error('Add reply error:', err);
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
});

// ✅ تعديل تعليق - المالك فقط
app.put('/api/projects/:id/comment/:commentId', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });

        const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
        if (!text) return res.status(400).json({ msg: 'نص التعليق مطلوب' });

        const comment = project.comments && project.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ msg: 'التعليق غير موجود' });

        if (comment.author !== req.user.username) {
            return res.status(403).json({ msg: 'غير مصرح لك بتعديل هذا التعليق' });
        }

        comment.text = text;
        comment.edited = true; // 🔴 إضافة حالة التعديل
        comment.updatedAt = new Date(); // 🔴 تحديث الوقت

        project.markModified('comments'); // 🔴 هام جداً: إجبار Mongoose على حفظ التعديل

        await project.save();
        res.json(project);
    } catch (err) {
        console.error('Edit comment error:', err);
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
});

// ✅ حذف تعليق - المالك فقط
app.delete('/api/projects/:id/comment/:commentId', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });

        const comment = project.comments && project.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ msg: 'التعليق غير موجود' });

        if (comment.author !== req.user.username) {
            return res.status(403).json({ msg: 'غير مصرح لك بحذف هذا التعليق' });
        }

        project.comments.pull(req.params.commentId);
        
        project.markModified('comments'); // 🔴 إجبار Mongoose على حفظ التعديل

        await project.save();
        res.json(project);
    } catch (err) {
        console.error('Delete comment error:', err);
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
});

// ✅ تعديل رد - صاحب الرد فقط
app.put('/api/projects/:id/comment/:commentId/reply/:replyId', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });

        const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
        if (!text) return res.status(400).json({ msg: 'نص الرد مطلوب' });

        const comment = project.comments && project.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ msg: 'التعليق غير موجود' });

        const reply = comment.replies && comment.replies.id(req.params.replyId);
        if (!reply) return res.status(404).json({ msg: 'الرد غير موجود' });

        if (reply.author !== req.user.username) {
            return res.status(403).json({ msg: 'غير مصرح لك بتعديل هذا الرد' });
        }

        reply.text = text;
        reply.edited = true; // 🔴 إضافة حالة التعديل
        reply.updatedAt = new Date(); // 🔴 تحديث الوقت

        project.markModified('comments'); // 🔴 هام جداً

        await project.save();
        res.json(project);
    } catch (err) {
        console.error('Edit reply error:', err);
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
});

// ✅ حذف رد - صاحب الرد فقط
app.delete('/api/projects/:id/comment/:commentId/reply/:replyId', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });

        const comment = project.comments && project.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ msg: 'التعليق غير موجود' });

        const reply = comment.replies && comment.replies.id(req.params.replyId);
        if (!reply) return res.status(404).json({ msg: 'الرد غير موجود' });

        if (reply.author !== req.user.username) {
            return res.status(403).json({ msg: 'غير مصرح لك بحذف هذا الرد' });
        }

        comment.replies.pull(req.params.replyId);
        
        project.markModified('comments'); // 🔴 إجبار Mongoose على حفظ التعديل

        await project.save();
        res.json(project);
    } catch (err) {
        console.error('Delete reply error:', err);
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
});

// ==========================================
// 6. مسار التقييم (Rating)
// ==========================================

// ✅ إضافة أو تحديث تقييم المشروع
app.post('/api/projects/:id/rating', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });

        const value = Number(req.body.rating);
        if (!Number.isInteger(value) || value < 1 || value > 5) {
            return res.status(400).json({ msg: 'يجب أن يكون التقييم رقماً صحيحاً بين 1 و5' });
        }

        project.ratings = project.ratings || [];
        const username = req.user.username;
        const existingRating = project.ratings.find(r => r.user === username);

        if (existingRating) {
            existingRating.value = value;
            existingRating.updatedAt = new Date();
        } else {
            project.ratings.push({
                user: username,
                value,
                createdAt: new Date()
            });
        }

        project.markModified('ratings'); // 🔴 إجبار Mongoose على حفظ التعديل

        await project.save();
        res.json(project);
    } catch (err) {
        console.error('Rating error:', err);
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
});

// ✅ جلب إحصائيات التقييمات
app.get('/api/projects/:id/ratings', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id).select('ratings');
        if (!project) return res.status(404).json({ msg: 'المشروع غير موجود' });

        const ratings = project.ratings || [];
        const total = ratings.length;
        const average = total
            ? Number((ratings.reduce((sum, r) => sum + Number(r.value || 0), 0) / total).toFixed(1))
            : 0;

        res.json({ ratings, total, average });
    } catch (err) {
        console.error('Get ratings error:', err);
        res.status(500).json({ msg: 'خطأ في السيرفر' });
    }
});

// ==========================================
// 7. تشغيل الخادم
// ==========================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 السيرفر يعمل على المنفذ: ${PORT}`));
