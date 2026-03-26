const crypto = require('crypto');

function validateInitData(initDataRaw, botToken) {
  if (!initDataRaw || !botToken) return null;

  try {
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) return null;

    const userStr = params.get('user');
    if (!userStr) return null;

    const user = JSON.parse(userStr);
    return {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name || '',
      username: user.username || '',
      languageCode: user.language_code || 'ru',
      isPremium: !!user.is_premium,
    };
  } catch {
    return null;
  }
}

function devUser() {
  return {
    id: 0,
    firstName: 'Dev',
    lastName: 'User',
    username: 'devuser',
    languageCode: 'ru',
    isPremium: false,
  };
}

module.exports = { validateInitData, devUser };
