import { useState, useCallback, useRef } from 'react';
import { Expense } from '../types';
import { useBackNavigation } from './useBackNavigation';
import { usePendingImages } from './usePendingImages';
import { OfflineImage } from '../utils/db';

import { ToastMessage } from '../types/toast.types';

export function useAppUI(isOnline: boolean) {
    // --- Toast State ---
    const [toast, setToast] = useState<ToastMessage | null>(null);
    const showToast = useCallback((msg: ToastMessage) => setToast(msg), []);

    // --- Image Analysis State (Managed by usePendingImages) ---
    const {
        pendingImages,
        setPendingImages,
        syncingImageId,
        setSyncingImageId,
        imageForAnalysis,
        setImageForAnalysis,
        refreshPendingImages,
        handleSharedFile,
        handleImagePick,
        sharedImageIdRef
    } = usePendingImages(isOnline, showToast);

    const [isParsingImage, setIsParsingImage] = useState(false);

    // --- Form Editing State ---
    const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
    const [editingRecurringExpense, setEditingRecurringExpense] = useState<Expense | undefined>(undefined);
    const [prefilledData, setPrefilledData] = useState<Partial<Omit<Expense, 'id'>> | undefined>(undefined);
    const [multipleExpensesData, setMultipleExpensesData] = useState<Partial<Omit<Expense, 'id'>>[]>([]);

    // Refs for tracking navigation flow
    const formOpenedFromCalculatorRef = useRef(false);

    // --- Navigation Hook (Wrapped) ---
    const nav = useBackNavigation(showToast, setImageForAnalysis);

    return {
        // Toast
        toast,
        showToast,

        // Image Parsing
        isParsingImage,
        setIsParsingImage,

        // Pending Images Hook Returns
        pendingImages,
        setPendingImages,
        syncingImageId,
        setSyncingImageId,
        imageForAnalysis,
        setImageForAnalysis,
        refreshPendingImages,
        handleSharedFile,
        handleImagePick,
        sharedImageIdRef,

        // Form Data
        editingExpense,
        setEditingExpense,
        editingRecurringExpense,
        setEditingRecurringExpense,
        prefilledData,
        setPrefilledData,
        multipleExpensesData,
        setMultipleExpensesData,
        formOpenedFromCalculatorRef,

        // Navigation
        nav
    };
}
