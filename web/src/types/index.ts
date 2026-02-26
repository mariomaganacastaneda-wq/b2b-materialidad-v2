export interface Organization {
    id: string;
    name: string;
    rfc: string;
    brand_name?: string;
    logo_url?: string;
    primary_color: string;
    theme_config: any;
}

export interface Profile {
    id: string;
    organization_id: string;
    email: string;
    full_name: string;
    role: 'ADMIN' | 'VENDEDOR' | 'FACTURACION' | 'REPRESENTANTE' | 'GESTOR_NOM151' | 'CXC' | 'CONTABLE' | 'CLIENTE';
    phone_whatsapp?: string;
    telegram_chat_id?: string;
    notification_prefered_channels?: string[];
}

export interface Quotation {
    id: string;
    consecutive_id: number;
    amount_total: number;
    amount_iva?: number;
    amount_ieps?: number;
    status: 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA' | 'EXPIRADA';
    created_at: string;
    vendor_id: string;
    description: string;
    is_contract_required: boolean;
    request_direct_invoice: boolean;
}

export interface Invoice {
    id: string;
    quotation_id?: string;
    internal_number: string;
    amount_total: number;
    status: 'SOLICITUD' | 'PREFACTURA_PENDIENTE' | 'EN_REVISION_VENDEDOR' | 'VALIDADA' | 'RECHAZADA' | 'TIMBRADA' | 'CANCELADA';
    created_at: string;
    preinvoice_url?: string;
    xml_url?: string;
    pdf_url?: string;
}

export interface CFDIProductService {
    code: string;
    name: string;
    level?: 'DIVISION' | 'GROUP' | 'CLASS' | 'PRODUCT';
    parent_code?: string;
    includes_iva_transfered: boolean;
    includes_ieps_transfered: boolean;
    similar_words?: string;
    similarity_threshold?: number;
    created_at?: string;
    updated_at?: string;
}

export interface CFDIRegime {
    code: string;
    name: string;
    applies_to_physical: boolean;
    applies_to_moral: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface CFDIUse {
    code: string;
    name: string;
    applies_to_physical: boolean;
    applies_to_moral: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface SATBlacklist {
    rfc: string;
    razon_social: string;
    estatus: string;
    fecha_publicacion: string;
    dof_url?: string;
    last_sync_at?: string;
}

export interface EconomicActivity {
    id: string;
    code: string;
    name: string;
    level: 'SECTOR' | 'SUBSECTOR' | 'RAMA' | 'SUBRAMA';
    parent_id?: string;
    metadata: any;
    description?: string;
    org_count?: number;
}

export interface SystemVersion {
    tag: string;
    name: string;
    description: string;
    changelog: { type: 'feat' | 'fix' | 'ui' | 'perf' | 'refactor', desc: string }[];
    rollback_script?: string;
    created_at: string;
}

export interface OrgBankAccount {
    id: string;
    organization_id: string;
    bank_name: string;
    account_number: string;
    holder_name: string;
    currency: 'MXN' | 'USD';
    is_active: boolean;
    created_at: string;
}

export interface QuotationPayment {
    id: string;
    quotation_id: string;
    bank_account_id?: string;
    amount: number;
    payment_date: string;
    payment_method: string;
    reference?: string;
    evidence_url?: string;
    status: 'PENDIENTE' | 'VERIFICADO' | 'RECHAZADO';
    notes?: string;
    created_at: string;
}
