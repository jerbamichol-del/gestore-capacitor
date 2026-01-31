import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CategoryService, Category, AVAILABLE_COLORS, AVAILABLE_ICONS } from '../services/category-service';
import { getCategoryIcon, getCategoryColor } from '../utils/categoryStyles';
import '../styles/CategoriesSettingsScreen.css';

interface CategoriesSettingsScreenProps {
    onBack: () => void;
}

// Icon groups for categorization in picker
const ICON_GROUPS = [
    {
        name: 'Generali',
        icons: AVAILABLE_ICONS.filter(icon =>
            !icon.startsWith('finanza') &&
            !icon.startsWith('svago') &&
            !icon.startsWith('shopping') &&
            !icon.startsWith('salute') &&
            !icon.startsWith('alimentari')
        )
    },
    {
        name: 'Alimentari',
        icons: AVAILABLE_ICONS.filter(icon => icon.startsWith('alimentari'))
    },
    {
        name: 'Salute',
        icons: AVAILABLE_ICONS.filter(icon => icon.startsWith('salute'))
    },
    {
        name: 'Finanza',
        icons: AVAILABLE_ICONS.filter(icon => icon.startsWith('finanza'))
    },
    {
        name: 'Svago',
        icons: AVAILABLE_ICONS.filter(icon => icon.startsWith('svago'))
    },
    {
        name: 'Shopping',
        icons: AVAILABLE_ICONS.filter(icon => icon.startsWith('shopping'))
    }
];

export const CategoriesSettingsScreen: React.FC<CategoriesSettingsScreenProps> = ({ onBack }) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isAnimating, setIsAnimating] = useState(false);
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [isAddingSubcategory, setIsAddingSubcategory] = useState<string | null>(null);
    const [newSubcategoryName, setNewSubcategoryName] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ id: string; name: string; count: number } | null>(null);
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [deletedDefaults, setDeletedDefaults] = useState<Category[]>([]);

    useEffect(() => {
        const timer = setTimeout(() => setIsAnimating(true), 10);
        return () => clearTimeout(timer);
    }, []);

    const handleBack = () => {
        setIsAnimating(false);
        setTimeout(onBack, 300);
    };

    // Form state for add/edit
    const [formData, setFormData] = useState({
        name: '',
        icon: 'other',
        color: AVAILABLE_COLORS[0],
    });

    const loadCategories = useCallback(() => {
        setCategories(CategoryService.getCategories());
        setDeletedDefaults(CategoryService.getDeletedDefaultCategories());
    }, []);

    useEffect(() => {
        loadCategories();

        const handleUpdate = () => loadCategories();
        window.addEventListener('categories-updated', handleUpdate);
        return () => window.removeEventListener('categories-updated', handleUpdate);
    }, [loadCategories]);

    const handleAddCategory = () => {
        setFormData({ name: '', icon: 'other', color: AVAILABLE_COLORS[0] });
        setIsAddingCategory(true);
        setEditingCategory(null);
    };

    const handleEditCategory = (cat: Category) => {
        setFormData({
            name: cat.name,
            icon: cat.icon || 'other',
            color: cat.color || AVAILABLE_COLORS[0],
        });
        setEditingCategory(cat);
        setIsAddingCategory(false);
    };

    const handleSaveCategory = () => {
        try {
            if (editingCategory) {
                CategoryService.updateCategory(editingCategory.id, {
                    name: formData.name,
                    icon: formData.icon,
                    color: formData.color,
                });
            } else {
                CategoryService.addCategory({
                    name: formData.name,
                    icon: formData.icon,
                    color: formData.color,
                    subcategories: [],
                });
            }
            setIsAddingCategory(false);
            setEditingCategory(null);
        } catch (error: any) {
            alert(error.message);
        }
    };

    const handleDeleteCategory = (cat: Category) => {
        const count = CategoryService.countExpensesInCategory(cat.name);
        setShowDeleteConfirm({ id: cat.id, name: cat.name, count });
    };

    const confirmDelete = () => {
        if (showDeleteConfirm) {
            CategoryService.deleteCategory(showDeleteConfirm.id);
            setShowDeleteConfirm(null);
        }
    };

    const handleRestoreDefault = (id: string) => {
        CategoryService.restoreDefaultCategory(id);
        setShowRestoreModal(false);
    };

    const handleAddSubcategory = (categoryId: string) => {
        if (!newSubcategoryName.trim()) return;
        try {
            CategoryService.addSubcategory(categoryId, newSubcategoryName.trim());
            setNewSubcategoryName('');
            setIsAddingSubcategory(null);
        } catch (error: any) {
            alert(error.message);
        }
    };

    const handleRemoveSubcategory = (categoryId: string, subcategoryName: string) => {
        CategoryService.removeSubcategory(categoryId, subcategoryName);
    };

    const toggleExpand = (id: string) => {
        setExpandedCategory(expandedCategory === id ? null : id);
    };

    const renderCategoryIcon = (cat: Category) => {
        const IconComponent = getCategoryIcon(cat.name);
        const color = cat.color || getCategoryColor(cat.name);

        return (
            <div className="category-icon-wrapper" style={{ backgroundColor: `${color}20` }}>
                <IconComponent size={24} color={color} />
            </div>
        );
    };

    return createPortal(
        <div className={`categories-settings-screen ${isAnimating ? 'active' : ''}`}>
            {/* Header */}
            <div className="categories-header-container">
                <header className="categories-header">
                    <button className="back-button" onClick={handleBack}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1>Categorie</h1>
                    <button className="add-button" onClick={handleAddCategory}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                    </button>
                </header>
            </div>

            {/* Content */}
            <div className="categories-content">
                {/* Restore deleted defaults */}
                {deletedDefaults.length > 0 && (
                    <button className="restore-defaults-btn" onClick={() => setShowRestoreModal(true)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                        </svg>
                        Ripristina categorie eliminate ({deletedDefaults.length})
                    </button>
                )}

                {/* Categories list */}
                <div className="categories-list">
                    {categories.map(cat => (
                        <div key={cat.id} className="category-item">
                            <div className="category-main" onClick={() => toggleExpand(cat.id)}>
                                {renderCategoryIcon(cat)}
                                <div className="category-info">
                                    <span className="category-name">{cat.name}</span>
                                    <span className="subcategory-count">
                                        {cat.subcategories.length} sottocategorie
                                    </span>
                                </div>
                                <div className="category-actions">
                                    <button
                                        className="edit-btn"
                                        onClick={(e) => { e.stopPropagation(); handleEditCategory(cat); }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                    </button>
                                    <button
                                        className="delete-btn"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat); }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        </svg>
                                    </button>
                                    <svg
                                        className={`expand-icon ${expandedCategory === cat.id ? 'expanded' : ''}`}
                                        width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                    >
                                        <path d="M6 9l6 6 6-6" />
                                    </svg>
                                </div>
                            </div>

                            {/* Subcategories */}
                            {expandedCategory === cat.id && (
                                <div className="subcategories-section">
                                    {cat.subcategories.length === 0 ? (
                                        <p className="no-subcategories">Nessuna sottocategoria</p>
                                    ) : (
                                        <ul className="subcategories-list">
                                            {cat.subcategories.map(sub => (
                                                <li key={sub} className="subcategory-item">
                                                    <span>{sub}</span>
                                                    <button
                                                        className="remove-sub-btn"
                                                        onClick={() => handleRemoveSubcategory(cat.id, sub)}
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M18 6L6 18M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}

                                    {/* Add subcategory */}
                                    {isAddingSubcategory === cat.id ? (
                                        <div className="add-subcategory-form">
                                            <input
                                                type="text"
                                                value={newSubcategoryName}
                                                onChange={(e) => setNewSubcategoryName(e.target.value)}
                                                placeholder="Nome sottocategoria"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleAddSubcategory(cat.id);
                                                    if (e.key === 'Escape') setIsAddingSubcategory(null);
                                                }}
                                            />
                                            <button onClick={() => handleAddSubcategory(cat.id)}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M20 6L9 17l-5-5" />
                                                </svg>
                                            </button>
                                            <button onClick={() => setIsAddingSubcategory(null)}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M18 6L6 18M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            className="add-subcategory-btn"
                                            onClick={() => { setIsAddingSubcategory(cat.id); setNewSubcategoryName(''); }}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M12 5v14M5 12h14" />
                                            </svg>
                                            Aggiungi sottocategoria
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Add/Edit Category Modal */}
            {(isAddingCategory || editingCategory) && (
                <div className="modal-overlay" onClick={() => { setIsAddingCategory(false); setEditingCategory(null); }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2>{editingCategory ? 'Modifica Categoria' : 'Nuova Categoria'}</h2>

                        <div className="form-group">
                            <label>Nome</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Es. Viaggi"
                                autoFocus
                            />
                        </div>

                        <div className="form-group color-group">
                            <label>Colore</label>
                            <div className="color-picker">
                                {AVAILABLE_COLORS.map(color => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={`color-option ${formData.color === color ? 'selected' : ''}`}
                                        style={{ backgroundColor: color }}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setFormData({ ...formData, color });
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Icona</label>
                            <div className="icon-picker-container">
                                {ICON_GROUPS.map(group => (
                                    <div key={group.name} className="icon-group">
                                        <h3 className="icon-group-title">{group.name}</h3>
                                        <div className="icon-picker">
                                            {group.icons.map(icon => {
                                                const IconComponent = getCategoryIcon(icon);
                                                const isSelected = formData.icon === icon;

                                                return (
                                                    <button
                                                        key={icon}
                                                        type="button"
                                                        className={`icon-option ${isSelected ? 'selected' : ''}`}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setFormData({ ...formData, icon });
                                                        }}
                                                        style={{ borderColor: isSelected ? formData.color : 'transparent' }}
                                                    >
                                                        <IconComponent size={24} color={isSelected ? formData.color : undefined} />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => { setIsAddingCategory(false); setEditingCategory(null); }}>
                                Annulla
                            </button>
                            <button
                                className="save-btn"
                                onClick={handleSaveCategory}
                                disabled={!formData.name.trim()}
                            >
                                Salva
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
                    <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
                        <div className="delete-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                        </div>
                        <h2>Elimina "{showDeleteConfirm.name}"?</h2>
                        {showDeleteConfirm.count > 0 ? (
                            <p className="warning">
                                ⚠️ Ci sono <strong>{showDeleteConfirm.count}</strong> spese in questa categoria.
                                <br />Le spese non verranno eliminate, ma la categoria verrà impostata su "Altro".
                            </p>
                        ) : (
                            <p>Questa categoria non contiene spese.</p>
                        )}
                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => setShowDeleteConfirm(null)}>
                                Annulla
                            </button>
                            <button className="delete-btn" onClick={confirmDelete}>
                                Elimina
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Restore Defaults Modal */}
            {showRestoreModal && (
                <div className="modal-overlay" onClick={() => setShowRestoreModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2>Ripristina Categorie</h2>
                        <p>Seleziona le categorie da ripristinare:</p>
                        <div className="restore-list">
                            {deletedDefaults.map(cat => (
                                <button
                                    key={cat.id}
                                    className="restore-item"
                                    onClick={() => handleRestoreDefault(cat.id)}
                                >
                                    {renderCategoryIcon(cat)}
                                    <span>{cat.name}</span>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                        <path d="M3 3v5h5" />
                                    </svg>
                                </button>
                            ))}
                        </div>
                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => setShowRestoreModal(false)}>
                                Chiudi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};

export default CategoriesSettingsScreen;
