"""Premium Catalogues — unified model for all inventory items.

Merges hotels, guides, restaurants, activities, transport, and monuments
into a single `premium_catalog_items` table with a `kind` discriminator.
"""

from typing import Optional
from sqlalchemy import String, Text, Numeric, Integer, Boolean, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


class PremiumCatalogItem(Base, BaseMixin):
    __tablename__ = "premium_catalog_items"

    kind: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True,
        comment="hotel | guide | restaurant | activity | transport | monument",
    )
    label: Mapped[str] = mapped_column(String(300), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Pricing
    unit_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    currency: Mapped[str] = mapped_column(String(10), default="MAD")

    # Category / tier
    category: Mapped[Optional[str]] = mapped_column(String(100))
    tier: Mapped[str] = mapped_column(String(30), default="premium", index=True)

    # Common metadata
    supplier: Mapped[Optional[str]] = mapped_column(String(200))
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    description: Mapped[Optional[str]] = mapped_column(Text)
    rating: Mapped[float] = mapped_column(Numeric(3, 1), default=5.0)
    status: Mapped[str] = mapped_column(String(50), default="active", index=True)

    # Kind-specific JSON (languages for guides, meal_type for restaurants, etc.)
    meta: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)

    # Capacity / pax
    capacity: Mapped[Optional[int]] = mapped_column(Integer)
    min_pax: Mapped[Optional[int]] = mapped_column(Integer)
    max_pax: Mapped[Optional[int]] = mapped_column(Integer)

    # Contact
    contact_name: Mapped[Optional[str]] = mapped_column(String(255))
    contact_email: Mapped[Optional[str]] = mapped_column(String(255))
    contact_phone: Mapped[Optional[str]] = mapped_column(String(50))

    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    __table_args__ = (
        Index("idx_pcat_kind_city", "kind", "city"),
        Index("idx_pcat_kind_tier", "kind", "tier"),
        Index("idx_pcat_featured", "is_featured"),
    )
