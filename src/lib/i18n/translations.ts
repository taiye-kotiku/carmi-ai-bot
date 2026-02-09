// src/lib/i18n/translations.ts
export const translations = {
    he: {
        // Common
        dashboard: 'לוח בקרה',
        generate: 'יצירה',
        gallery: 'גלריה',
        settings: 'הגדרות',
        help: 'עזרה',
        logout: 'התנתקות',
        login: 'התחברות',
        signup: 'הרשמה',
        loading: 'טוען...',
        error: 'שגיאה',
        success: 'הצלחה',
        submit: 'שלח',
        cancel: 'ביטול',
        save: 'שמור',
        delete: 'מחק',
        download: 'הורד',

        // Generate
        generateImage: 'יצירת תמונה',
        generateVideo: 'יצירת וידאו',
        generateCarousel: 'יצירת קרוסלה',
        generateCharacter: 'יצירת דמות',
        textToImage: 'טקסט לתמונה',
        textToVideo: 'טקסט לוידאו',
        imageToVideo: 'תמונה לוידאו',
        cartoonize: 'קריקטורה',
        prompt: 'תיאור',
        promptPlaceholder: 'תאר את מה שברצונך ליצור...',
        generateNow: 'צור עכשיו',
        generating: 'יוצר...',

        // Gallery
        myGallery: 'הגלריה שלי',
        noImages: 'אין תמונות עדיין',

        // Characters
        myCharacters: 'הדמויות שלי',
        createCharacter: 'צור דמות חדשה',
        characterName: 'שם הדמות',
        uploadImages: 'העלה תמונות',
        trainModel: 'אמן מודל',
        training: 'מאמן...',
        ready: 'מוכן',

        // Credits
        credits: 'קרדיטים',
        remainingCredits: 'קרדיטים נותרים',
        buyCredits: 'רכוש קרדיטים',

        // App name
        appName: 'קוסם',
        appDescription: 'פלטפורמה מבוססת AI ליצירת תוכן',
    },
    en: {
        // Common
        dashboard: 'Dashboard',
        generate: 'Generate',
        gallery: 'Gallery',
        settings: 'Settings',
        help: 'Help',
        logout: 'Logout',
        login: 'Login',
        signup: 'Sign Up',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        submit: 'Submit',
        cancel: 'Cancel',
        save: 'Save',
        delete: 'Delete',
        download: 'Download',

        // Generate
        generateImage: 'Generate Image',
        generateVideo: 'Generate Video',
        generateCarousel: 'Generate Carousel',
        generateCharacter: 'Generate Character',
        textToImage: 'Text to Image',
        textToVideo: 'Text to Video',
        imageToVideo: 'Image to Video',
        cartoonize: 'Cartoonize',
        prompt: 'Prompt',
        promptPlaceholder: 'Describe what you want to create...',
        generateNow: 'Generate Now',
        generating: 'Generating...',

        // Gallery
        myGallery: 'My Gallery',
        noImages: 'No images yet',

        // Characters
        myCharacters: 'My Characters',
        createCharacter: 'Create New Character',
        characterName: 'Character Name',
        uploadImages: 'Upload Images',
        trainModel: 'Train Model',
        training: 'Training...',
        ready: 'Ready',

        // Credits
        credits: 'Credits',
        remainingCredits: 'Remaining Credits',
        buyCredits: 'Buy Credits',

        // App name
        appName: 'Kosem',
        appDescription: 'AI-powered content creation platform',
    },
} as const;

export type Locale = keyof typeof translations;
export type TranslationKey = keyof typeof translations.he;