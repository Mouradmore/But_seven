const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ msg: 'لا يوجد توكن، تم رفض الصلاحية' });
  
  try {
    // فك تشفير التوكن واستخراج بيانات المستخدم منه
    const decoded = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'التوكن غير صالح' });
  }
};
const admin = require('firebase-admin');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  // التأكد من وجود رأس التحقق ويبدأ بـ Bearer
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'غير مصرح بالوصول، يرجى تسجيل الدخول أولاً.' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // التحقق من صلاحية التوكن وفكه لقراءة بيانات المستخدم
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // إرفاق بيانات المستخدم بالطلب ليتم استخدامها في المسارات اللاحقة
    req.user = decodedToken;
    next(); // السماح بالانتقال إلى المسار الفعلي
  } catch (error) {
    console.error('خطأ في التحقق من التوكن:', error);
    return res.status(403).json({ error: 'جلسة العمل غير صالحة أو منتهية الصلاحية.' });
  }
};

module.exports = verifyToken;
