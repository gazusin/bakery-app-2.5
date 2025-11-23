// Placeholder - este archivo temporal contiene la función handleUpdateLogEntry
// que será insertada en production/page.tsx

const handleUpdateLogEntry = async () => {
    setIsSubmitting(true);
    const activeBranch = getActiveBranchId();
    if (!activeBranch || !editingLogEntry || !originalLogEntryForEdit) {
        toast({ title: "Error", description: "Faltan datos para editar o no hay sede activa.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    const recipesForBranch = loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranch);
    const recipeDetailsOriginal = recipesForBranch.find(r => r.name.toLowerCase() === originalLogEntryForEdit.product.toLowerCase());
    const isIntermediateOriginal = recipeDetailsOriginal?.isIntermediate || false;
    const recipeDetailsNew = recipesForBranch.find(r => r.name.toLowerCase() === editProduct.toLowerCase());
    const isIntermediateNew = recipeDetailsNew?.isIntermediate || false;

    if (!editProduct || !editDate || !editStaff || !editExpectedQuantity || !editActualQuantity) {
        toast({ title: "Error", description: "Faltan campos obligatorios para editar.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    const updatedExpectedNum = parseInt(editExpectedQuantity, 10);
    const updatedActualNum = parseInt(editActualQuantity, 10);
    let updatedUnitPriceNum = parseFloat(editUnitPrice);

    if (isNaN(updatedExpectedNum) || updatedExpectedNum <= 0 || isNaN(updatedActualNum) || updatedActualNum < 0) {
        toast({ title: "Error", description: "Cantidades deben ser números válidos (esperada positiva, real no negativa).", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    if (!isIntermediateNew && (isNaN(updatedUnitPriceNum) || updatedUnitPriceNum < 0)) {
        toast({ title: "Error", description: "El precio unitario debe ser un número válido no negativo para productos finales.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    } else if (isIntermediateNew) {
        updatedUnitPriceNum = parseFloat(editUnitPrice) || 0;
    }

    const productDateStrNew = format(editDate!, "yyyy-MM-dd");
    const originalProductDateStr = originalLogEntryForEdit.date;
    const currentTimestamp = new Date().toISOString();

    // Revert original state
    const revertOriginalMaterialsResult = consumeOrRevertMaterials(originalLogEntryForEdit.product, originalLogEntryForEdit.batchSizeMultiplier, 'revert');
    if (!revertOriginalMaterialsResult.success) {
        toast({ title: "Error al Revertir Original", description: "No se pudo revertir el consumo de materiales original al editar. Contacta soporte.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    if (!isIntermediateOriginal && originalLogEntryForEdit.actualQuantity > 0) {
        updatePackagingMaterials(originalLogEntryForEdit.actualQuantity, 'revert', { bagName: originalLogEntryForEdit.bagUsed, labelName: originalLogEntryForEdit.labelUsed });
    }

    if (isIntermediateOriginal && recipeDetailsOriginal) {
        let currentRawInventory = loadRawMaterialInventoryData(activeBranch);
        const idx = currentRawInventory.findIndex(item => item.name.toLowerCase() === recipeDetailsOriginal.name.toLowerCase());
        if (idx !== -1) {
            currentRawInventory[idx].quantity -= originalLogEntryForEdit.actualQuantity;
            if (currentRawInventory[idx].quantity <= 0.0001) currentRawInventory.splice(idx, 1);
        }
        saveRawMaterialInventoryData(activeBranch, currentRawInventory.filter(item => item.quantity > 0.0001));
    } else {
        let tempProducts = loadProductsForBranch(activeBranch);
        const productIndex = tempProducts.findIndex(p => p.name.toLowerCase() === originalLogEntryForEdit.product.toLowerCase());
        if (productIndex !== -1) {
            tempProducts[productIndex].stock -= originalLogEntryForEdit.actualQuantity;
            if (tempProducts[productIndex].stock < 0) tempProducts[productIndex].stock = 0;
            saveProductsDataForBranch(activeBranch, tempProducts);
        }
    }
    if (!isIntermediateOriginal && recipeDetailsOriginal) {
        updateProductionGoals(originalLogEntryForEdit.product, originalLogEntryForEdit.actualQuantity, originalProductDateStr, 'subtract');
    }

    // Apply new state
    const consumeUpdatedMaterialsResult = consumeOrRevertMaterials(editProduct, editBatchSizeMultiplier, 'consume');
    if (!consumeUpdatedMaterialsResult.success) {
        // Rollback
        consumeOrRevertMaterials(originalLogEntryForEdit.product, originalLogEntryForEdit.batchSizeMultiplier, 'consume');
        if (!isIntermediateOriginal && originalLogEntryForEdit.actualQuantity > 0) {
            updatePackagingMaterials(originalLogEntryForEdit.actualQuantity, 'consume', { bagName: originalLogEntryForEdit.bagUsed, labelName: originalLogEntryForEdit.labelUsed });
        }

        if (consumeUpdatedMaterialsResult.materialsDeficit) {
            setDeficitMaterials(consumeUpdatedMaterialsResult.materialsDeficit);
            setCurrentProductionDeficitData({ productName: editProduct, batchMultiplier: editBatchSizeMultiplier });
            setDeficitType(consumeUpdatedMaterialsResult.deficitType || 'raw_material_shortage');
            setBestTransferSourceInfo(consumeUpdatedMaterialsResult.bestTransferSourceInfo || null);
            setShowDeficitAlert(true);
        } else {
            toast({ title: "Error al Editar: Consumo de Materiales", description: "No se pudo actualizar el consumo de materiales", variant: "destructive" });
        }
        setIsSubmitting(false);
        return;
    }

    if (!isIntermediateNew && updatedActualNum > 0) {
        const packagingResult = updatePackagingMaterials(updatedActualNum, 'consume', { bagName: editSelectedBagName, labelName: editSelectedLabelName });
        if (!packagingResult.success) {
            toast({
                title: "Error al Editar: Faltan Materiales de Empaque",
                description: `No hay suficiente stock para: ${packagingResult.deficits?.map(d => `${d.name} (Disp: ${d.available})`).join(', ')}. Cambios revertidos.`,
                variant: "destructive",
                duration: 8000
            });
            // Rollback
            consumeOrRevertMaterials(editProduct, editBatchSizeMultiplier, 'revert');
            consumeOrRevertMaterials(originalLogEntryForEdit.product, originalLogEntryForEdit.batchSizeMultiplier, 'consume');
            if (!isIntermediateOriginal && originalLogEntryForEdit.actualQuantity > 0) {
                updatePackagingMaterials(originalLogEntryForEdit.actualQuantity, 'consume', { bagName: originalLogEntryForEdit.bagUsed, labelName: originalLogEntryForEdit.labelUsed });
            }
            setIsSubmitting(false);
            return;
        }
    }

    if (isIntermediateNew && recipeDetailsNew) {
        let currentRawInventory = loadRawMaterialInventoryData(activeBranch);
        const idx = currentRawInventory.findIndex(item => item.name.toLowerCase() === recipeDetailsNew.name.toLowerCase());
        let intermediateUnitNew = normalizeUnit(recipeDetailsNew.outputUnit || (recipeDetailsNew.name.toLowerCase().includes("melado") || recipeDetailsNew.name.toLowerCase().includes("jarabe") ? "l" : "kg")) as any;
        if (!VALID_BASE_UNITS.includes(intermediateUnitNew)) {
            intermediateUnitNew = recipeDetailsNew.name.toLowerCase().includes("melado") || recipeDetailsNew.name.toLowerCase().includes("jarabe") ? "l" : "kg";
        }
        if (idx !== -1) {
            if (normalizeUnit(currentRawInventory[idx].unit) === intermediateUnitNew) {
                currentRawInventory[idx].quantity += updatedActualNum;
            } else {
                currentRawInventory.push({ name: recipeDetailsNew.name, quantity: updatedActualNum, unit: intermediateUnitNew });
            }
        } else {
            currentRawInventory.push({ name: recipeDetailsNew.name, quantity: updatedActualNum, unit: intermediateUnitNew });
        }
        saveRawMaterialInventoryData(activeBranch, currentRawInventory.filter(item => item.quantity > 0.0001));
    } else {
        let tempProducts = loadProductsForBranch(activeBranch);
        const productIndex = tempProducts.findIndex(p => p.name.toLowerCase() === editProduct.toLowerCase());
        if (productIndex !== -1) {
            tempProducts[productIndex].stock += updatedActualNum;
            tempProducts[productIndex].lastUpdated = productDateStrNew;
            tempProducts[productIndex].unitPrice = updatedUnitPriceNum;
        } else {
            tempProducts.unshift({
                id: `PROD_NEW_EDIT_${Date.now()}`,
                name: editProduct,
                category: recipeDetailsNew?.category || "General",
                stock: updatedActualNum,
                unitPrice: updatedUnitPriceNum,
                lastUpdated: productDateStrNew,
                image: "https://placehold.co/40x40.png",
                aiHint: recipeDetailsNew?.aiHint || "producto panaderia",
                sourceBranchId: activeBranch,
                sourceBranchName: availableBranches.find(b => b.id === activeBranch)?.name || 'Desconocida'
            });
        }
        saveProductsDataForBranch(activeBranch, tempProducts);
    }

    if (!isIntermediateNew && recipeDetailsNew) {
        updateProductionGoals(editProduct, updatedActualNum, productDateStrNew, 'add');
    }

    const currentLogsForBranch = loadFromLocalStorageForBranch<ProductionLogEntry[]>(KEYS.PRODUCTION_LOG, activeBranch);
    const updatedLogs = currentLogsForBranch.map(log =>
        log.id === editingLogEntry.id
            ? {
                ...log,
                product: editProduct,
                batchSizeMultiplier: editBatchSizeMultiplier,
                expectedQuantity: updatedExpectedNum,
                actualQuantity: updatedActualNum,
                date: productDateStrNew,
                staff: editStaff.trim(),
                unitPrice: updatedUnitPriceNum,
                batchNumber: editBatchNumber.trim() || undefined,
                bagUsed: editSelectedBagName || undefined,
                labelUsed: editSelectedLabelName || undefined,
                timestamp: currentTimestamp,
            }
            : log
    ).sort((a, b) => {
        const dateA = a.timestamp ? parseISO(a.timestamp).getTime() : (a.date ? parseISO(a.date).getTime() : 0);
        const dateB = b.timestamp ? parseISO(b.timestamp).getTime() : (b.date ? parseISO(b.date).getTime() : 0);
        return dateB - dateA;
    });
    saveProductionLogData(updatedLogs);
    setAllProductionLog(updatedLogs);

    // Remove from pending if it matches
    if (pendingProductions.length > 0) {
        const matchingPending = pendingProductions.find(p => p.productName === editProduct && Math.abs(p.batchMultiplier - editBatchSizeMultiplier) < 0.01);
        if (matchingPending) {
            const remainingPending = pendingProductions.filter(p => p.id !== matchingPending.id);
            setPendingProductions(remainingPending);
            savePendingProductionsData(activeBranch, remainingPending);
        }
    }

    toast({ title: "Éxito", description: `Producción de ${editProduct} actualizada.` });
    setIsEditLogDialogOpen(false);
    setEditingLogEntry(null);
    setOriginalLogEntryForEdit(null);
    setIsSubmitting(false);
};
