import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export function DeleteCharacterModal({ isOpen, onClose, onConfirm }: Props) {
    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
                    <AlertDialogDescription>
                        פעולה זו תמחק את הדמות ואת כל המודלים המאומנים שלה לצמיתות.
                        לא ניתן לשחזר פעולה זו.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel onClick={onClose}>ביטול</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm} className="bg-destructive hover:bg-destructive/90">
                        מחק לצמיתות
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}