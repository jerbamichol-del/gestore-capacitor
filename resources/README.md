# 📱 App Assets

## 🎨 Icon Requirements

**File**: `icon.png`

- **Size**: 1024x1024px minimum (higher resolution recommended)
- **Format**: PNG with transparency
- **Content**: Your app logo centered

## 🌅 Splash Screen (Optional)

**File**: `splash.png`

- **Size**: 2732x2732px
- **Format**: PNG
- **Content**: Logo + background

## 🚀 Generate Assets

After adding `icon.png` to this folder, run:

```bash
npx @capacitor/assets generate --android
```

This will generate all required icon sizes for Android in:
- `android/app/src/main/res/mipmap-*/`

## 📝 Next Steps

1. Upload your logo as `resources/icon.png`
2. Run the generation command above
3. Rebuild the app: `npm run build:android`
