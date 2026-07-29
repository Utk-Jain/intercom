from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from database.database import get_db
from database.models import Article, Category, Workspace
from database.schemas import (
    ArticleCreate, ArticleUpdate, ArticleResponse,
    CategoryCreate, CategoryResponse
)
from services.auth_service import get_current_user

router = APIRouter(prefix="", tags=["knowledge_base"])

# --- Category Endpoints ---

@router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    workspace_id = current_user.get("workspace_id")
    res = await db.execute(select(Category).where(Category.workspace_id == workspace_id))
    cats = res.scalars().all()
    return [CategoryResponse(id=c.id, workspace_id=c.workspace_id, name=c.name) for c in cats]

@router.post("/categories", response_model=CategoryResponse)
async def create_category(payload: CategoryCreate, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage knowledge base categories")
    workspace_id = current_user.get("workspace_id")
    cat = Category(workspace_id=workspace_id, name=payload.name)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return CategoryResponse(id=cat.id, workspace_id=cat.workspace_id, name=cat.name)

# --- Article Endpoints ---

@router.get("/articles", response_model=List[ArticleResponse])
async def list_articles(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    workspace_id = current_user.get("workspace_id")
    res = await db.execute(
        select(Article).where(Article.workspace_id == workspace_id).options(selectinload(Article.category))
    )
    articles = res.scalars().all()
    return [
        ArticleResponse(
            id=a.id,
            workspace_id=a.workspace_id,
            category_id=a.category_id,
            category_name=a.category.name if a.category else None,
            title=a.title,
            content=a.content,
            published=a.published
        )
        for a in articles
    ]

@router.post("/articles", response_model=ArticleResponse)
async def create_article(payload: ArticleCreate, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create articles")
    workspace_id = current_user.get("workspace_id")
    article = Article(
        workspace_id=workspace_id,
        category_id=payload.category_id,
        title=payload.title,
        content=payload.content,
        published=payload.published
    )
    db.add(article)
    await db.commit()
    await db.refresh(article)

    cat_name = None
    if article.category_id:
        c_res = await db.execute(select(Category).where(Category.id == article.category_id))
        cat = c_res.scalars().first()
        if cat:
            cat_name = cat.name

    return ArticleResponse(
        id=article.id,
        workspace_id=article.workspace_id,
        category_id=article.category_id,
        category_name=cat_name,
        title=article.title,
        content=article.content,
        published=article.published
    )

@router.patch("/articles/{id}", response_model=ArticleResponse)
async def update_article(
    id: str,
    payload: ArticleUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update articles")
    workspace_id = current_user.get("workspace_id")
    res = await db.execute(
        select(Article).where(Article.id == id, Article.workspace_id == workspace_id).options(selectinload(Article.category))
    )
    article = res.scalars().first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    if payload.title is not None:
        article.title = payload.title
    if payload.content is not None:
        article.content = payload.content
    if payload.category_id is not None:
        article.category_id = payload.category_id if payload.category_id != "" else None
    if payload.published is not None:
        article.published = payload.published

    await db.commit()
    await db.refresh(article)

    return ArticleResponse(
        id=article.id,
        workspace_id=article.workspace_id,
        category_id=article.category_id,
        category_name=article.category.name if article.category else None,
        title=article.title,
        content=article.content,
        published=article.published
    )

# --- Public Help Center Endpoint ---

@router.get("/help/{workspace_id}")
async def public_help_center(
    workspace_id: str,
    q: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Public Help Center endpoint for customer search and browsing published articles.
    """
    # Find workspace by ID or custom domain or slug
    ws_res = await db.execute(
        select(Workspace).where(or_(Workspace.id == workspace_id, Workspace.custom_domain == workspace_id, Workspace.name == workspace_id))
    )
    workspace = ws_res.scalars().first()
    if not workspace:
        # Fallback to first workspace if ID doesn't match directly
        ws_fallback = await db.execute(select(Workspace))
        workspace = ws_fallback.scalars().first()
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace help center not found")

    # Fetch Categories
    cat_res = await db.execute(select(Category).where(Category.workspace_id == workspace.id))
    categories = cat_res.scalars().all()

    # Query published articles using simple SQL LIKE/ILIKE
    query = select(Article).where(Article.workspace_id == workspace.id, Article.published == True).options(selectinload(Article.category))

    if q:
        search_pattern = f"%{q}%"
        query = query.where(or_(Article.title.ilike(search_pattern), Article.content.ilike(search_pattern)))

    if category_id:
        query = query.where(Article.category_id == category_id)

    art_res = await db.execute(query)
    articles = art_res.scalars().all()

    return {
        "workspace_name": workspace.name,
        "custom_domain": workspace.custom_domain,
        "categories": [{"id": c.id, "name": c.name} for c in categories],
        "articles": [
            {
                "id": a.id,
                "title": a.title,
                "content": a.content,
                "category_id": a.category_id,
                "category_name": a.category.name if a.category else "General"
            }
            for a in articles
        ]
    }
