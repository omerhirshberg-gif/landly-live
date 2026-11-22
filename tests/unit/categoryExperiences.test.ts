import { describe, expect, it } from 'vitest'
import { categoryExperiences } from '@/lib/home/categoryExperiences'

const chain = (id: string, raayonitCategory: string) => ({ id, raayonitCategory, fulfillmentType: 'raayonit_pool', perkScope: 'single' })

describe('categoryExperiences', () => {
  it('drops categories with no live venue or no photo, and keeps the fixed order', () => {
    const out = categoryExperiences([chain('a', 'spa'), chain('b', 'cinemas'), chain('c', 'networks'), chain('d', 'jewelry'), chain('e', 'hotels')])
    expect(out.map((c) => [c.id, c.photo, c.count])).toEqual([['spa', 'pampering', 1], ['hotels', 'tourism', 1], ['jewelry', 'fashion', 1]])
  })
  it('gives the restaurants photo to the larger restaurant category', () => {
    const chefs = [chain('a', 'chef-restaurants'), chain('b', 'chef-restaurants'), chain('c', 'cafes-restaurants')]
    expect(categoryExperiences(chefs)[0]).toMatchObject({ id: 'chef-restaurants', photo: 'restaurants', count: 2 })
    expect(categoryExperiences([chain('a', 'cafes-restaurants'), chain('b', 'chef-restaurants')])[0].id).toBe('cafes-restaurants')
  })
})
