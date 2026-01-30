// services/category-service.ts
// Servizio per gestire categorie e sottocategorie personalizzabili

export interface Category {
    id: string;
    name: string;
    icon?: string;
    color?: string;
    subcategories: string[];
    isDefault?: boolean; // true se è una categoria di default
    order?: number; // per ordinamento personalizzato
}

// Categorie di default (stesse di CATEGORIES in types.ts)
const DEFAULT_CATEGORIES: Category[] = [
    { id: 'alimentari', name: 'Alimentari', icon: 'food', color: '#F97316', subcategories: ['Ristorante', 'Bar', 'Autogrill'], isDefault: true, order: 0 },
    { id: 'trasporti', name: 'Trasporti', icon: 'transport', color: '#3B82F6', subcategories: ['Mezzi Pubblici', 'Carburante', 'Taxi', 'Assicurazione', 'Manutenzione Auto', 'Pedaggio'], isDefault: true, order: 1 },
    { id: 'casa', name: 'Casa', icon: 'home', color: '#8B5CF6', subcategories: ['Affitto/Mutuo', 'Bollette', 'Manutenzione', 'Arredamento'], isDefault: true, order: 2 },
    { id: 'shopping', name: 'Shopping', icon: 'shopping', color: '#EC4899', subcategories: ['Supermercato', 'Abbigliamento', 'Elettronica', 'Libri', 'Regali', 'Tabacco/Svapo', 'Abbonamenti'], isDefault: true, order: 3 },
    { id: 'tempo-libero', name: 'Tempo Libero', icon: 'leisure', color: '#10B981', subcategories: ['Cinema', 'Concerti', 'Sport', 'Viaggi'], isDefault: true, order: 4 },
    { id: 'salute', name: 'Salute', icon: 'health', color: '#EF4444', subcategories: ['Farmacia', 'Visite Mediche', 'Assicurazione'], isDefault: true, order: 5 },
    { id: 'istruzione', name: 'Istruzione', icon: 'education', color: '#6366F1', subcategories: ['Corsi', 'Libri', 'Tasse Scolastiche'], isDefault: true, order: 6 },
    { id: 'lavoro', name: 'Lavoro', icon: 'work', color: '#64748B', subcategories: ['Pasti', 'Materiale Ufficio'], isDefault: true, order: 7 },
    { id: 'beneficienza', name: 'Beneficienza', icon: 'charity', color: '#F59E0B', subcategories: ['Donazione', 'Adozione a distanza', 'Elemosina'], isDefault: true, order: 8 },
    { id: 'altro', name: 'Altro', icon: 'other', color: '#94A3B8', subcategories: [], isDefault: true, order: 9 },
];

// Lista di icone disponibili per le categorie
export const AVAILABLE_ICONS = [
    'food', 'transport', 'home', 'shopping', 'leisure', 'health',
    'education', 'work', 'charity', 'other', 'solid', 'gift', 'travel',
    'entertainment', 'pets', 'beauty', 'fitness', 'tech', 'music',
    'art', 'garden', 'baby', 'insurance', 'taxes', 'investment',
    'finanza1', 'finanza2', 'finanza3', 'finanza4', 'finanza5', 'finanza6',
    'finanza7', 'finanza8', 'finanza9', 'finanza10', 'finanza11', 'finanza12',
    'finanza13', 'finanza14', 'finanza15', 'finanza16'
];

// Colori disponibili per le categorie
export const AVAILABLE_COLORS = [
    '#F97316', // Orange
    '#3B82F6', // Blue
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#10B981', // Green
    '#EF4444', // Red
    '#6366F1', // Indigo
    '#64748B', // Slate
    '#F59E0B', // Amber
    '#94A3B8', // Gray
    '#14B8A6', // Teal
    '#D946EF', // Fuchsia
    '#84CC16', // Lime
    '#0EA5E9', // Sky
    '#F43F5E', // Rose
];

export class CategoryService {
    private static readonly STORAGE_KEY = 'custom_categories_v1';
    private static readonly DELETED_DEFAULTS_KEY = 'deleted_default_categories_v1';

    /**
     * Get all categories (default + custom, excluding deleted defaults)
     */
    static getCategories(): Category[] {
        const custom = this.getCustomCategories();
        const deletedDefaults = this.getDeletedDefaults();

        // Filter out deleted default categories
        const activeDefaults = DEFAULT_CATEGORIES.filter(c => !deletedDefaults.includes(c.id));

        // Merge custom modifications with defaults
        const merged = activeDefaults.map(def => {
            const customized = custom.find(c => c.id === def.id);
            return customized || def;
        });

        // Add purely custom categories (not modifications of defaults)
        const purelyCustom = custom.filter(c => !DEFAULT_CATEGORIES.some(d => d.id === c.id));

        return [...merged, ...purelyCustom].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    }

    /**
     * Get categories as Record format (for backward compatibility with CATEGORIES constant)
     */
    static getCategoriesAsRecord(): Record<string, string[]> {
        const categories = this.getCategories();
        const record: Record<string, string[]> = {};
        for (const cat of categories) {
            record[cat.name] = cat.subcategories;
        }
        return record;
    }

    /**
     * Get category names only
     */
    static getCategoryNames(): string[] {
        return this.getCategories().map(c => c.name);
    }

    /**
     * Get subcategories for a category
     */
    static getSubcategories(categoryName: string): string[] {
        const cat = this.getCategories().find(c => c.name === categoryName);
        return cat?.subcategories || [];
    }

    /**
     * Get category by name
     */
    static getCategoryByName(name: string): Category | undefined {
        return this.getCategories().find(c => c.name === name);
    }

    /**
     * Get category by ID
     */
    static getCategoryById(id: string): Category | undefined {
        return this.getCategories().find(c => c.id === id);
    }

    /**
     * Add a new custom category
     */
    static addCategory(category: Omit<Category, 'id' | 'isDefault'>): Category {
        const custom = this.getCustomCategories();
        const allCategories = this.getCategories();

        // Generate unique ID
        const id = this.generateId(category.name);

        // Check if name already exists
        if (allCategories.some(c => c.name.toLowerCase() === category.name.toLowerCase())) {
            throw new Error('Una categoria con questo nome esiste già');
        }

        const newCategory: Category = {
            ...category,
            id,
            isDefault: false,
            order: category.order ?? allCategories.length,
        };

        custom.push(newCategory);
        this.saveCustomCategories(custom);

        console.log('✅ Category added:', newCategory);
        this.dispatchUpdate();

        return newCategory;
    }

    /**
     * Update an existing category
     */
    static updateCategory(id: string, updates: Partial<Omit<Category, 'id' | 'isDefault'>>): Category {
        const custom = this.getCustomCategories();
        const defaultCat = DEFAULT_CATEGORIES.find(c => c.id === id);

        // Check if name conflict
        if (updates.name) {
            const existing = this.getCategories().find(c =>
                c.name.toLowerCase() === updates.name!.toLowerCase() && c.id !== id
            );
            if (existing) {
                throw new Error('Una categoria con questo nome esiste già');
            }
        }

        const existingIndex = custom.findIndex(c => c.id === id);

        if (existingIndex >= 0) {
            // Update existing custom category
            custom[existingIndex] = { ...custom[existingIndex], ...updates };
        } else if (defaultCat) {
            // Create custom version of default category
            custom.push({ ...defaultCat, ...updates, isDefault: false });
        } else {
            throw new Error('Categoria non trovata');
        }

        this.saveCustomCategories(custom);
        console.log('✅ Category updated:', id);
        this.dispatchUpdate();

        return this.getCategoryById(id)!;
    }

    /**
     * Delete a category
     */
    static deleteCategory(id: string): void {
        const custom = this.getCustomCategories();
        const defaultCat = DEFAULT_CATEGORIES.find(c => c.id === id);

        // Get the category to be deleted (to know its name)
        const categoryToDelete = this.getCategoryById(id);
        if (categoryToDelete) {
            // Migrate all expenses from the deleted category to "Altro"
            this.migrateExpensesToAltro(categoryToDelete.name);
        }

        if (defaultCat) {
            // Mark default as deleted
            const deletedDefaults = this.getDeletedDefaults();
            if (!deletedDefaults.includes(id)) {
                deletedDefaults.push(id);
                localStorage.setItem(this.DELETED_DEFAULTS_KEY, JSON.stringify(deletedDefaults));
            }
            // Also remove any custom modifications
            const filtered = custom.filter(c => c.id !== id);
            this.saveCustomCategories(filtered);
        } else {
            // Remove custom category
            const filtered = custom.filter(c => c.id !== id);
            this.saveCustomCategories(filtered);
        }

        console.log('✅ Category deleted:', id);
        this.dispatchUpdate();
    }

    /**
     * Migrate expenses from a category to "Altro"
     */
    private static migrateExpensesToAltro(oldCategoryName: string): void {
        const expensesKey = 'expenses_v2';
        const expenses = JSON.parse(localStorage.getItem(expensesKey) || '[]');

        let migratedCount = 0;
        const updatedExpenses = expenses.map((expense: any) => {
            if (expense.category === oldCategoryName) {
                migratedCount++;
                return {
                    ...expense,
                    category: 'Altro',
                    subcategory: expense.subcategory || '' // Keep subcategory as-is or clear it
                };
            }
            return expense;
        });

        if (migratedCount > 0) {
            localStorage.setItem(expensesKey, JSON.stringify(updatedExpenses));
            console.log(`✅ Migrated ${migratedCount} expenses from "${oldCategoryName}" to "Altro"`);
        }
    }

    /**
     * Restore a deleted default category
     */
    static restoreDefaultCategory(id: string): void {
        const deletedDefaults = this.getDeletedDefaults();
        const filtered = deletedDefaults.filter(d => d !== id);
        localStorage.setItem(this.DELETED_DEFAULTS_KEY, JSON.stringify(filtered));

        console.log('✅ Default category restored:', id);
        this.dispatchUpdate();
    }

    /**
     * Add a subcategory to a category
     */
    static addSubcategory(categoryId: string, subcategoryName: string): void {
        const cat = this.getCategoryById(categoryId);
        if (!cat) throw new Error('Categoria non trovata');

        if (cat.subcategories.includes(subcategoryName)) {
            throw new Error('Questa sottocategoria esiste già');
        }

        this.updateCategory(categoryId, {
            subcategories: [...cat.subcategories, subcategoryName]
        });
    }

    /**
     * Remove a subcategory from a category
     */
    static removeSubcategory(categoryId: string, subcategoryName: string): void {
        const cat = this.getCategoryById(categoryId);
        if (!cat) throw new Error('Categoria non trovata');

        this.updateCategory(categoryId, {
            subcategories: cat.subcategories.filter(s => s !== subcategoryName)
        });
    }

    /**
     * Rename a subcategory
     */
    static renameSubcategory(categoryId: string, oldName: string, newName: string): void {
        const cat = this.getCategoryById(categoryId);
        if (!cat) throw new Error('Categoria non trovata');

        if (cat.subcategories.includes(newName) && oldName !== newName) {
            throw new Error('Questa sottocategoria esiste già');
        }

        this.updateCategory(categoryId, {
            subcategories: cat.subcategories.map(s => s === oldName ? newName : s)
        });
    }

    /**
     * Reorder categories
     */
    static reorderCategories(orderedIds: string[]): void {
        const custom = this.getCustomCategories();

        orderedIds.forEach((id, index) => {
            const cat = this.getCategoryById(id);
            if (cat) {
                const existingIndex = custom.findIndex(c => c.id === id);
                if (existingIndex >= 0) {
                    custom[existingIndex].order = index;
                } else {
                    // Create custom entry for default category to save order
                    const defaultCat = DEFAULT_CATEGORIES.find(c => c.id === id);
                    if (defaultCat) {
                        custom.push({ ...defaultCat, order: index });
                    }
                }
            }
        });

        this.saveCustomCategories(custom);
        this.dispatchUpdate();
    }

    /**
     * Get deleted default categories (for restore functionality)
     */
    static getDeletedDefaultCategories(): Category[] {
        const deletedIds = this.getDeletedDefaults();
        return DEFAULT_CATEGORIES.filter(c => deletedIds.includes(c.id));
    }

    /**
     * Reset all categories to default
     */
    static resetToDefaults(): void {
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.DELETED_DEFAULTS_KEY);
        console.log('✅ Categories reset to defaults');
        this.dispatchUpdate();
    }

    /**
     * Check how many expenses use a category (for delete confirmation)
     */
    static countExpensesInCategory(categoryName: string): number {
        const expenses = JSON.parse(localStorage.getItem('expenses_v2') || '[]');
        return expenses.filter((e: any) => e.category === categoryName).length;
    }

    // Private helpers

    private static getCustomCategories(): Category[] {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    }

    private static saveCustomCategories(categories: Category[]): void {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(categories));
    }

    private static getDeletedDefaults(): string[] {
        const stored = localStorage.getItem(this.DELETED_DEFAULTS_KEY);
        return stored ? JSON.parse(stored) : [];
    }

    private static generateId(name: string): string {
        const base = name.toLowerCase()
            .replace(/[àáâãäå]/g, 'a')
            .replace(/[èéêë]/g, 'e')
            .replace(/[ìíîï]/g, 'i')
            .replace(/[òóôõö]/g, 'o')
            .replace(/[ùúûü]/g, 'u')
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        return `${base}-${Date.now().toString(36)}`;
    }

    private static dispatchUpdate(): void {
        window.dispatchEvent(new CustomEvent('categories-updated'));
    }
}
